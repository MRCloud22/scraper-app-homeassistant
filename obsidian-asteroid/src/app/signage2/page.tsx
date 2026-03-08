'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Flower, QrCode } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './signage2.module.css';
import { filterPastAppointments } from '@/utils/filterAppointments';

// Reference resolution the design is built for (portrait digital signage)
const REF_W = 1080;
const REF_H = 1920;

interface Appointment {
    date: string;
    time: string;
    treatment: string;
    price: string;
    originalPrice?: string;
    imageUrl: string | null;
}

// Config for a single circle: size + any position side (px values)
interface CircleConfig {
    size?: number;
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    color?: string;   // CSS color value, e.g. "#5E7367" or "rgba(94,115,103,0.8)"
}

// Config for free-floating elements (logo, QR): size + optional absolute position
interface ElementConfig {
    size?: number;    // size in px (height for logo, width/height for QR)
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
}

interface CustomSettings {
    logo?: string;
    heroImage?: string;       // image filename for the hero circle
    massageImage?: string;    // image filename for the massage circle
    qrCode?: string;
    backgroundImage?: string;
    backgroundColor?: string;    // CSS color for the page background (default: #F4F1E9)
    title?: string;
    subtitle?: string;
    listTitle?: string;
    emptyText?: string;
    pillColor?: string;
    qrLabel?: string;
    qrUrl?: string;
    theme?: string;
    logoConfig?: ElementConfig;   // size + optional absolute position
    qrConfig?: ElementConfig;     // size + optional absolute position
    // Per-circle position + size (all in px on the 1080×1920 reference canvas)
    circleMain?: CircleConfig;    // large green background circle
    circleAccent?: CircleConfig;  // small mint accent circle
    circleFooter?: CircleConfig;  // massage image circle
    heroCircle?: CircleConfig;    // hero image circle
    timeConfig?: ElementConfig & { show?: boolean, color?: string };
    lastUpdatedConfig?: ElementConfig & { show?: boolean, color?: string };
    promoConfig?: {
        text?: string;         // The promo text to show (supports \n for line breaks)
        duration?: number;     // How many seconds to show the promo (default: 8)
        show?: boolean;        // Enable/disable (default: true)
        fontSize?: number;     // Font size in px (default: 38)
        color?: string;        // Text color (default: #5E7367)
        // Directional offsets in px (shift the text within the content area)
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
}

/** Builds an inline style for one circle, merging defaults with settings overrides. */
function buildCircleStyle(
    defaults: { size: number; top?: number; right?: number; bottom?: number; left?: number },
    override?: CircleConfig
): React.CSSProperties {
    const merged = { ...defaults, ...override };
    // Start with all sides as 'auto' so conflicting CSS values don’t bleed through
    const style: React.CSSProperties = {
        width: `${merged.size}px`,
        height: `${merged.size}px`,
        top: 'auto', right: 'auto', bottom: 'auto', left: 'auto',
    };
    if (merged.top !== undefined) style.top = `${merged.top}px`;
    if (merged.right !== undefined) style.right = `${merged.right}px`;
    if (merged.bottom !== undefined) style.bottom = `${merged.bottom}px`;
    if (merged.left !== undefined) style.left = `${merged.left}px`;
    if (merged.color !== undefined) style.backgroundColor = merged.color;
    return style;
}

function Clock({ config }: { config?: ElementConfig & { show?: boolean, color?: string } }) {
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentTime(new Date());
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    if (config?.show === false || !currentTime) return null;

    const s: React.CSSProperties = {
        position: 'absolute',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontSize: config?.size ? `${config.size}px` : '48px',
        top: (config?.top ?? config?.right ?? config?.bottom ?? config?.left) === undefined ? 40 : config?.top,
        right: (config?.top ?? config?.right ?? config?.bottom ?? config?.left) === undefined ? 60 : config?.right,
        bottom: config?.bottom,
        left: config?.left,
        color: config?.color || '#5E7367',
    };

    return (
        <div className={styles.timeDisplayWrapper} style={s}>
            <div className={styles.timeDisplay}>
                {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
            <div className={styles.timeDate}>
                {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
        </div>
    );
}



export default function Signage2Page() {
    const { settings } = useSettings();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [customSettings, setCustomSettings] = useState<CustomSettings>({});
    const [visibleStart, setVisibleStart] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isStaticMode, setIsStaticMode] = useState(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [showPromo, setShowPromo] = useState(false);
    const VISIBLE_COUNT = 5;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);

    // --- Uniform scale logic ---------------------------------------------------
    useEffect(() => {
        function updateScale() {
            if (!wrapperRef.current || !scaleRef.current) return;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            // Scale so the 1920×1080 design fits exactly inside the viewport
            const scale = Math.min(vw / REF_W, vh / REF_H);
            scaleRef.current.style.transform = `scale(${scale})`;

            // Centre the scaled canvas inside the viewport
            const scaledW = REF_W * scale;
            const scaledH = REF_H * scale;
            scaleRef.current.style.left = `${(vw - scaledW) / 2}px`;
            scaleRef.current.style.top = `${(vh - scaledH) / 2}px`;
        }

        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('../appointments.json', { cache: 'no-store' });
            if (!response.ok) throw new Error('Fetch failed');

            const data = await response.json();
            if (data.success) {
                setAppointments(data.appointments);
                if (data.lastUpdated) {
                    setLastUpdated(data.lastUpdated);
                }
            }
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCustomSettings = useCallback(async () => {
        // Try the Next.js API first (HA Ingress mode).
        // Fall back to static settings.json (FTP mode).
        try {
            const apiRes = await fetch('../api/custom-settings', { cache: 'no-store' });
            const text = await apiRes.text();

            if (apiRes.ok && !text.startsWith('<!DOCTYPE')) {
                const data = JSON.parse(text);
                setCustomSettings(data.signage2 || data);
                setIsStaticMode(false);
                setSettingsLoaded(true);
                return;
            }
        } catch {
            // API unreachable — static/FTP mode
        }

        // Fallback: static file on FTP server
        // Page is at /signage2/ so settings.json is one level up: ../settings.json
        try {
            const staticRes = await fetch('../settings.json', { cache: 'no-store' });
            if (staticRes.ok) {
                const data = await staticRes.json();
                setCustomSettings(data.signage2 || data);
                setIsStaticMode(true);
                setSettingsLoaded(true);
            }
        } catch {
            // No settings available
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;
        fetchAppointments();
        fetchCustomSettings();
        const pollTimer = setInterval(() => {
            fetchAppointments();
            fetchCustomSettings();
        }, 60000);
        return () => clearInterval(pollTimer);
    }, [fetchAppointments, fetchCustomSettings, mounted]);

    const futureAppointments = useMemo(() =>
        filterPastAppointments(appointments),
        [appointments]);

    // --- Rotation logic with promo interstitial ---
    useEffect(() => {
        if (!mounted) return;

        const promoEnabled = customSettings.promoConfig?.show !== false && !!customSettings.promoConfig?.text;
        const rotateMs = settings.signageRotationInterval * 1000;
        const promoDurationMs = (customSettings.promoConfig?.duration ?? 8) * 1000;

        // Single page (or no appointments): no page rotation needed
        if (futureAppointments.length <= VISIBLE_COUNT) {
            setVisibleStart(0);

            if (!promoEnabled || futureAppointments.length === 0) {
                setShowPromo(false);
                return;
            }

            // Single page with promo: cycle between appointments ↔ promo
            if (showPromo) {
                const promoTimer = setTimeout(() => {
                    setShowPromo(false);
                }, promoDurationMs);
                return () => clearTimeout(promoTimer);
            } else {
                const showTimer = setTimeout(() => {
                    setShowPromo(true);
                }, rotateMs);
                return () => clearTimeout(showTimer);
            }
        }

        // Multiple pages
        if (showPromo) {
            // Currently showing promo — wait, then go back to first page
            const promoTimer = setTimeout(() => {
                setShowPromo(false);
                setVisibleStart(0);
            }, promoDurationMs);
            return () => clearTimeout(promoTimer);
        }

        // Normal appointment rotation
        const rotateTimer = setInterval(() => {
            setVisibleStart((prev: number) => {
                const next = prev + VISIBLE_COUNT;
                if (next >= futureAppointments.length) {
                    // Completed a full cycle
                    if (promoEnabled) {
                        setShowPromo(true);
                        return prev; // keep current until promo takes over
                    }
                    return 0; // no promo → loop back
                }
                return next;
            });
        }, rotateMs);

        return () => clearInterval(rotateTimer);
    }, [futureAppointments.length, settings.signageRotationInterval, mounted, showPromo, customSettings.promoConfig]);

    // Ensure we don't display an empty page if data shrinks out of bounds
    const safeVisibleStart = visibleStart >= futureAppointments.length ? 0 : visibleStart;

    const visibleAppointments = futureAppointments.slice(
        safeVisibleStart,
        safeVisibleStart + VISIBLE_COUNT
    );

    // Asset path: static = relative media folder, HA = API endpoint

    // Dynamic assets — static uses relative path, HA uses relative API URL
    const assetPath = isStaticMode ? '../media' : '../api/custom-media';

    // Stable cache busting token that only changes when the settings configuration literally changes.
    // This prevents the heavy images from being re-downloaded every minute on weak hardware like a Raspberry Pi.
    const settingsStr = JSON.stringify(customSettings);
    const cacheBustToken = useMemo(() => {
        let hash = 0;
        for (let i = 0; i < settingsStr.length; i++) {
            hash = Math.imul(31, hash) + settingsStr.charCodeAt(i) | 0;
        }
        return hash.toString(36);
    }, [settingsStr]);
    const cacheBust = `?t=${cacheBustToken}`;

    const logoSrc = customSettings.logo ? `${assetPath}/${customSettings.logo}${cacheBust}` : null;
    const heroSrc = customSettings.heroImage ? `${assetPath}/${customSettings.heroImage}${cacheBust}` : null;
    const massageSrc = customSettings.massageImage ? `${assetPath}/${customSettings.massageImage}${cacheBust}` : `${assetPath}/massage.png${cacheBust}`;
    const qrSrc = customSettings.qrCode ? `${assetPath}/${customSettings.qrCode}${cacheBust}` : null;
    const bgUrl = customSettings.backgroundImage && customSettings.backgroundImage !== 'none' ? `url(${assetPath}/${customSettings.backgroundImage}${cacheBust})` : 'none';

    // Per-circle inline styles — merge hardcoded defaults with settings.json overrides
    const decor1Style = buildCircleStyle({ size: 1200, top: 280, left: -280 }, customSettings.circleMain);
    const decor2Style = buildCircleStyle({ size: 520, bottom: -120, right: -120 }, customSettings.circleAccent);
    const massageStyle = buildCircleStyle({ size: 420, bottom: -80, left: -80 }, customSettings.circleFooter);
    const heroStyle = buildCircleStyle({ size: 300, top: 160, right: 50 }, customSettings.heroCircle);

    return (
        <div className={styles.viewportWrapper} ref={wrapperRef}>
            <div className={styles.scaleWrapper} ref={scaleRef}>
                <div
                    className={`${styles.container} ${customSettings.theme === 'dark' ? styles.darkTheme : ''} ${settingsLoaded ? styles.ready : ''}`}
                    style={{ backgroundImage: bgUrl, backgroundSize: 'cover', backgroundColor: customSettings.backgroundColor || undefined }}
                >
                    {/* Time Layer */}
                    <Clock config={customSettings.timeConfig} />

                    {/* Background Decorations */}
                    <div className={styles.backgroundDecor} style={decor1Style} />
                    <div className={styles.backgroundDecor2} style={decor2Style} />

                    {/* Bottom-left massage image circle */}
                    <div className={styles.massageImage} style={massageStyle}>
                        <img src={massageSrc} alt="Massage" loading="eager" />
                    </div>

                    {/* Top Right Hero Image */}
                    {heroSrc && (
                        <div className={styles.heroImage} style={heroStyle}>
                            <img src={heroSrc} alt="Hero" loading="eager" />
                        </div>
                    )}

                    {/* Header */}
                    <header className={styles.header}>
                        <div
                            className={styles.logoIcon}
                            style={(() => {
                                const lc = customSettings.logoConfig;
                                if (!lc) return undefined;
                                const hasPos = lc.top !== undefined || lc.right !== undefined
                                    || lc.bottom !== undefined || lc.left !== undefined;
                                const s: React.CSSProperties = {};
                                if (lc.size) { s.width = lc.size; s.height = lc.size; }
                                if (hasPos) {
                                    s.position = 'absolute'; s.zIndex = 10;
                                    if (lc.top !== undefined) s.top = lc.top;
                                    if (lc.right !== undefined) s.right = lc.right;
                                    if (lc.bottom !== undefined) s.bottom = lc.bottom;
                                    if (lc.left !== undefined) s.left = lc.left;
                                }
                                return s;
                            })()}
                        >
                            {logoSrc ? (
                                <img
                                    src={logoSrc}
                                    alt="Logo"
                                    loading="eager"
                                    style={customSettings.logoConfig?.size
                                        ? { height: customSettings.logoConfig.size, width: 'auto' }
                                        : undefined}
                                />
                            ) : (!settingsLoaded && (
                                <Flower size={customSettings.logoConfig?.size ?? 80} color="#5E7367" />
                            ))}
                        </div>
                        <div className={styles.logoText}>
                            <h1>{settingsLoaded ? (customSettings.title ?? "") : "BEAUTYKUPPEL"}</h1>
                            <p>{settingsLoaded ? (customSettings.subtitle ?? "") : "Therme Bad Aibling"}</p>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main className={styles.main}>
                        <h2 className={styles.title} dangerouslySetInnerHTML={{ __html: (settingsLoaded ? (customSettings.listTitle ?? "") : "FREIE TERMINE<br/>HEUTE").replace('\\n', '<br/>') }} />

                        {showPromo ? (
                            <div
                                className={styles.promoScreen}
                                style={(() => {
                                    const pc = customSettings.promoConfig;
                                    return {
                                        fontSize: pc?.fontSize ? `${pc.fontSize}px` : '38px',
                                        color: pc?.color || '#5E7367',
                                        // Directional padding offsets shift the centred text
                                        paddingTop: pc?.top !== undefined ? `${60 + pc.top}px` : '60px',
                                        paddingBottom: pc?.bottom !== undefined ? `${60 + pc.bottom}px` : '60px',
                                        paddingLeft: pc?.left !== undefined ? `${80 + pc.left}px` : '80px',
                                        paddingRight: pc?.right !== undefined ? `${80 + pc.right}px` : '80px',
                                    };
                                })()}
                                dangerouslySetInnerHTML={{
                                    __html: (customSettings.promoConfig?.text || '').replace(/\\n/g, '<br/>')
                                }}
                            />
                        ) : loading && appointments.length === 0 ? (
                            <div className={styles.emptyState}>Laden...</div>
                        ) : futureAppointments.length === 0 ? (
                            <div className={styles.emptyState}>{settingsLoaded ? (customSettings.emptyText ?? "") : (settings.emptyStateText || 'Aktuell sind keine freien Termine vorhanden.')}</div>
                        ) : (
                            <div className={styles.appointmentList}>
                                {visibleAppointments.map((apt: Appointment, index: number) => (
                                    <div
                                        key={`${apt.date}-${apt.time}-${index}`}
                                        className={styles.appointmentPill}
                                        style={{
                                            animationDelay: `${index * 0.15}s`,
                                            backgroundColor: settingsLoaded ? (customSettings.pillColor || "transparent") : '#F4F1E9'
                                        }}
                                    >
                                        <div className={styles.pillImage}>
                                            {apt.imageUrl ? (
                                                <img src={apt.imageUrl} alt={apt.treatment} loading="eager" />
                                            ) : (
                                                <div style={{ backgroundColor: '#D7E4D9', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Flower color="#5E7367" size={50} />
                                                </div>
                                            )}
                                        </div>
                                        <div className={styles.pillContent}>
                                            <div className={styles.time}>{apt.time} Uhr</div>
                                            <div className={styles.treatment}>{apt.treatment}</div>
                                        </div>
                                        <div className={styles.priceContainer}>
                                            <div className={styles.price}>{apt.price || '45€'}</div>
                                            {apt.originalPrice && <div className={styles.originalPrice}>{apt.originalPrice}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </main>

                    {/* Footer */}
                    <footer className={styles.footer}>
                        <div
                            className={styles.qrSection}
                            style={(() => {
                                const qc = customSettings.qrConfig;
                                if (!qc) return undefined;
                                const hasPos = qc.top !== undefined || qc.right !== undefined
                                    || qc.bottom !== undefined || qc.left !== undefined;
                                const s: React.CSSProperties = {};
                                // Notice: size is NOT applied here, but on the image!
                                if (hasPos) {
                                    s.position = 'absolute'; s.zIndex = 10;
                                    if (qc.top !== undefined) s.top = qc.top;
                                    if (qc.right !== undefined) s.right = qc.right;
                                    if (qc.bottom !== undefined) s.bottom = qc.bottom;
                                    if (qc.left !== undefined) s.left = qc.left;
                                }
                                return s;
                            })()}
                        >
                            <div className={styles.qrContainer}>
                                {qrSrc ? (
                                    <img
                                        src={qrSrc}
                                        alt="QR"
                                        style={customSettings.qrConfig?.size ? { width: customSettings.qrConfig.size, height: customSettings.qrConfig.size } : undefined}
                                    />
                                ) : (!settingsLoaded && (
                                    <QrCode size={customSettings.qrConfig?.size ?? 150} color="#5E7367" />
                                ))}
                            </div>
                            <div className={styles.qrInfoText}>
                                {settingsLoaded ? (customSettings.qrLabel ?? "") : "Infos & Buchung unter"}<br />
                                <strong>{settingsLoaded ? (customSettings.qrUrl ?? "") : "beautykuppel.de/termine"}</strong>
                            </div>
                        </div>

                        {/* Last Updated Timestamp */}
                        {customSettings.lastUpdatedConfig?.show !== false && lastUpdated && (
                            <div
                                className={styles.lastUpdatedDisplay}
                                style={(() => {
                                    const lc = customSettings.lastUpdatedConfig;
                                    const s: React.CSSProperties = {
                                        position: 'absolute',
                                        zIndex: 20,
                                        // default position if fully undefined
                                        bottom: (lc?.top ?? lc?.right ?? lc?.bottom ?? lc?.left) === undefined ? 30 : lc?.bottom,
                                        right: (lc?.top ?? lc?.right ?? lc?.bottom ?? lc?.left) === undefined ? 40 : lc?.right,
                                        top: lc?.top,
                                        left: lc?.left,
                                        fontSize: lc?.size ? `${lc.size}px` : '20px',
                                        color: lc?.color || 'rgba(94, 115, 103, 0.7)',
                                        fontWeight: '400'
                                    };
                                    return s;
                                })()}
                            >
                                Stand: {new Date(lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                            </div>
                        )}
                    </footer>

                </div>
            </div>
        </div>
    );
}
