'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Flower, QrCode } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './signage2.module.css';
import { filterPastAppointments } from '@/utils/filterAppointments';

interface Appointment {
    date: string;
    time: string;
    treatment: string;
    price: string;
    imageUrl: string | null;
}

interface CustomSettings {
    logo?: string;
    heroImage?: string;
    qrCode?: string;
    backgroundImage?: string;
    title?: string;
    subtitle?: string;
    listTitle?: string;
    emptyText?: string;
    pillColor?: string;
    qrLabel?: string;
    qrUrl?: string;
    theme?: string;
}

const VERSION = "0.4.28";

export default function Signage2Page() {
    const { settings } = useSettings();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [customSettings, setCustomSettings] = useState<CustomSettings>({});
    const [visibleStart, setVisibleStart] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [lastFetch, setLastFetch] = useState<string>('Never');
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const VISIBLE_COUNT = 5;

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
            }
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCustomSettings = useCallback(async () => {
        setLastFetch(new Date().toLocaleTimeString());

        // Strategy: always try the Next.js API first (HA Ingress mode).
        // If the API responds with 404 or a network error, fall back to
        // fetching settings.json directly from the same origin (static/FTP mode).
        try {
            const apiRes = await fetch('../api/custom-settings', { cache: 'no-store' });
            const text = await apiRes.text();

            // If the API returned HTML it's a redirect/404 — not our API
            if (apiRes.ok && !text.startsWith('<!DOCTYPE')) {
                const data = JSON.parse(text);
                setCustomSettings(data.signage2 || data);
                setDebugInfo({ mode: 'Server (API)', foundPath: '../api/custom-settings' });
                return;
            }
        } catch (_apiErr) {
            // API unreachable — we are probably in static/FTP mode
        }

        // Fallback: static file on FTP server (or /public during dev)
        try {
            const staticRes = await fetch('settings.json', { cache: 'no-store' });
            if (staticRes.ok) {
                const data = await staticRes.json();
                setCustomSettings(data.signage2 || data);
                setDebugInfo({ mode: 'Static (FTP)', foundPath: 'settings.json' });
            } else {
                setDebugInfo({ mode: 'Static (FTP)', error: 'settings.json not found' });
            }
        } catch (staticErr: any) {
            setDebugInfo({ mode: 'Unknown', error: staticErr.message });
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

    useEffect(() => {
        if (!mounted || appointments.length <= VISIBLE_COUNT) return;

        const rotateMs = settings.signageRotationInterval * 1000;
        const rotateTimer = setInterval(() => {
            setVisibleStart((prev: number) => {
                const next = prev + VISIBLE_COUNT;
                return next >= appointments.length ? 0 : next;
            });
        }, rotateMs);

        return () => clearInterval(rotateTimer);
    }, [appointments.length, settings.signageRotationInterval, mounted]);

    const futureAppointments = useMemo(() =>
        filterPastAppointments(appointments),
        [appointments]);

    const visibleAppointments = futureAppointments.slice(
        visibleStart,
        visibleStart + VISIBLE_COUNT
    );

    // Detect mode for assets (Static = FTP server, Server = HA Ingress via API)
    const isStatic = debugInfo?.mode?.startsWith('Static');

    // Dynamic assets — static uses relative path, HA uses relative API URL
    // Cache-busting: append ?t= to image URLs so browser refetches on each settings poll
    const assetPath = isStatic ? 'media' : '../api/custom-media';
    const cacheBust = `?t=${Math.floor(Date.now() / 60000)}`; // changes every minute
    const logoSrc = customSettings.logo ? `${assetPath}/${customSettings.logo}${cacheBust}` : null;
    const heroSrc = customSettings.heroImage ? `${assetPath}/${customSettings.heroImage}${cacheBust}` : null;
    const qrSrc = customSettings.qrCode ? `${assetPath}/${customSettings.qrCode}${cacheBust}` : null;
    const bgUrl = customSettings.backgroundImage && customSettings.backgroundImage !== 'none' ? `url(${assetPath}/${customSettings.backgroundImage}${cacheBust})` : 'none';

    return (
        <div
            className={`${styles.container} ${customSettings.theme === 'dark' ? styles.darkTheme : ''}`}
            style={{ backgroundImage: bgUrl, backgroundSize: 'cover' }}
        >
            {/* Background Decorations */}
            <div className={styles.backgroundDecor} />
            <div className={styles.backgroundDecor2} />

            {/* Top Right Hero Image */}
            {heroSrc && (
                <div className={styles.heroImage}>
                    <img src={heroSrc} alt="Hero" />
                </div>
            )}

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logoIcon}>
                    {logoSrc ? (
                        <img src={logoSrc} alt="Logo" style={{ height: '80px', width: 'auto' }} />
                    ) : (
                        <Flower size={80} color="#5E7367" />
                    )}
                </div>
                <div className={styles.logoText}>
                    <h1>{customSettings.title || "BEAUTYKUPPEL"}</h1>
                    <p>{customSettings.subtitle || "Therme Bad Aibling"}</p>
                </div>
            </header>

            {/* Main Content */}
            <main className={styles.main}>
                <h2 className={styles.title} dangerouslySetInnerHTML={{ __html: (customSettings.listTitle || "FREIE TERMINE<br/>HEUTE").replace('\n', '<br/>') }} />

                {loading && appointments.length === 0 ? (
                    <div className={styles.emptyState}>Laden...</div>
                ) : futureAppointments.length === 0 ? (
                    <div className={styles.emptyState}>{customSettings.emptyText || settings.emptyStateText || 'Aktuell sind keine freien Termine vorhanden.'}</div>
                ) : (
                    <div className={styles.appointmentList}>
                        {visibleAppointments.map((apt: Appointment, index: number) => (
                            <div
                                key={`${apt.date}-${apt.time}-${index}`}
                                className={styles.appointmentPill}
                                style={{
                                    animationDelay: `${index * 0.15}s`,
                                    backgroundColor: customSettings.pillColor || '#F4F1E9'
                                }}
                            >
                                <div className={styles.pillImage}>
                                    {apt.imageUrl ? (
                                        <img src={apt.imageUrl} alt={apt.treatment} />
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
                                <div className={styles.price}>{apt.price || '45€'}</div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.qrSection}>
                    <div className={styles.qrContainer}>
                        {qrSrc ? (
                            <img src={qrSrc} alt="QR" />
                        ) : (
                            <QrCode size={130} color="#5E7367" />
                        )}
                    </div>
                    <div className={styles.qrInfoText}>
                        {customSettings.qrLabel || "Infos & Buchung unter"}<br />
                        <strong>{customSettings.qrUrl || "beautykuppel.de/termine"}</strong>
                    </div>
                </div>
            </footer>
            {/* Version & Debug (Hidden by default, hover near bottom to see) */}
            <div className={styles.versionTag}>
                v{VERSION} | Settings: {Object.keys(customSettings).length > 1 ? 'Loaded' : 'Empty/Default'} | Last: {lastFetch}
                <br />
                {debugInfo ? (
                    <span>
                        Ping: {debugInfo.pingStatus || 'N/A'} |
                        Path: {debugInfo.foundPath || 'NONE'} |
                        Err: {debugInfo.error || debugInfo.listError || 'None'}
                    </span>
                ) : 'Connecting...'}
            </div>
        </div>
    );
}
