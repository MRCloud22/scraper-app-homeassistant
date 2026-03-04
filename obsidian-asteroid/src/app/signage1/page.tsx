'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Flower, QrCode } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './signage1.module.css';
import { filterPastAppointments } from '@/utils/filterAppointments';

// Reference resolution the design is built for (portrait digital signage)
const REF_W = 1080;
const REF_H = 1920;

interface Appointment {
    date: string;
    time: string;
    treatment: string;
    price: string;
    imageUrl: string | null;
}

export default function Signage1Page() {
    const { settings } = useSettings();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [customSettings, setCustomSettings] = useState<any>({});
    const [visibleStart, setVisibleStart] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const VISIBLE_COUNT = 3;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef<HTMLDivElement>(null);

    // --- Uniform scale logic ---------------------------------------------------
    useEffect(() => {
        function updateScale() {
            if (!wrapperRef.current || !scaleRef.current) return;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            // Scale so the 1080×1920 design fits exactly inside the viewport
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
            }
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCustomSettings = useCallback(async () => {
        try {
            const isStatic = typeof window !== 'undefined' &&
                (window.location.pathname.endsWith('.html') ||
                    !window.location.pathname.includes('/api/ingress/'));

            if (isStatic) {
                const response = await fetch('settings.json', { cache: 'no-store' });
                if (response.ok) {
                    const data = await response.json();
                    setCustomSettings(data.signage1 || data);
                }
                return;
            }

            const response = await fetch('../api/custom-settings', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setCustomSettings(data.signage1 || data);
            }
        } catch (error) {
            console.error('Error fetching custom settings:', error);
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
            setVisibleStart((prev) => {
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

    // Detect static mode
    const isStatic = typeof window !== 'undefined' &&
        (window.location.pathname.endsWith('.html') ||
            !window.location.pathname.includes('/api/ingress/'));

    // Dynamic assets
    const assetPath = isStatic ? 'media' : '/api/custom-media';
    const logoSrc = customSettings.logo ? `${assetPath}/${customSettings.logo}` : null;
    const bgUrl = customSettings.backgroundImage ? `url(${assetPath}/${customSettings.backgroundImage})` : 'none';
    const qrSrc = customSettings.qrCode ? `${assetPath}/${customSettings.qrCode}` : null;

    return (
        <div className={styles.viewportWrapper} ref={wrapperRef}>
            <div className={styles.scaleWrapper} ref={scaleRef}>
                <div className={styles.container} style={{ backgroundImage: bgUrl, backgroundSize: 'cover' }}>
                    {/* Header with Logo */}
                    <header className={styles.header}>
                        <div className={styles.logoIcon}>
                            {logoSrc ? (
                                <img src={logoSrc} alt="Logo" />
                            ) : (
                                <Flower size={80} color="#C5A059" />
                            )}
                        </div>
                        <div className={styles.logoText}>
                            <h1>{customSettings.title || "Beautykuppel"}</h1>
                            <p>{customSettings.subtitle || "Therme Bad Aibling"}</p>
                        </div>
                    </header>

                    {/* Main Circle Content */}
                    <main className={styles.main}>
                        <div className={styles.circleContainer} style={customSettings.circleColor ? { backgroundColor: customSettings.circleColor } : {}}>
                            <h2 className={styles.title}>{customSettings.listTitle || "Freie Termine heute"}</h2>

                            {loading && appointments.length === 0 ? (
                                <p>Laden...</p>
                            ) : futureAppointments.length === 0 ? (
                                <p className={styles.emptyState}>{customSettings.emptyText || settings.emptyStateText || 'Aktuell sind keine freien Termine vorhanden.'}</p>
                            ) : (
                                <table className={styles.appointmentsTable}>
                                    <thead className={styles.tableHeader}>
                                        <tr>
                                            <th>Uhrzeit</th>
                                            <th>Anwendung</th>
                                            <th>Preis</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleAppointments.map((apt, index) => (
                                            <tr
                                                key={`${apt.date}-${apt.time}-${index}`}
                                                className={styles.appointmentRow}
                                                style={{ animationDelay: `${index * 0.1}s` }}
                                            >
                                                <td className={styles.time}>{apt.time}</td>
                                                <td className={styles.treatment}>{apt.treatment}</td>
                                                <td className={styles.price}>{apt.price}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </main>

                    {/* Footer with Floating Elements */}
                    <footer className={styles.footer}>
                        <div className={styles.footerCircles}>
                            <div className={styles.qrCircle}>
                                {qrSrc ? (
                                    <img src={qrSrc} alt="QR" style={{ width: '120px', height: '120px' }} />
                                ) : (
                                    <QrCode size={120} color="#5D7266" />
                                )}
                                <span className={styles.qrText}>{customSettings.qrLabel || "Hier buchen"}</span>
                            </div>
                            <div className={styles.infoCircle}>
                                {customSettings.infoText || "Buchung direkt am Empfang"}
                            </div>
                        </div>

                        <div className={styles.mintCircle}>
                            <QrCode size={100} color="#5D7266" />
                            <span className={styles.qrText}>Infos unter<br />beautykuppel.de</span>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
