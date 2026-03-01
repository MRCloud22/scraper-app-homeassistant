'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Sparkles, Droplets, Leaf } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './signage.module.css';
import { filterPastAppointments } from '@/utils/filterAppointments';

interface Appointment {
    date: string;
    time: string;
    treatment: string;
    price: string;
    imageUrl: string | null;
}

export default function SignagePage() {
    const { settings } = useSettings();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [visibleStart, setVisibleStart] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const VISIBLE_COUNT = 6;

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const isExport = process.env.NEXT_PUBLIC_EXPORT === 'true';
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
            const cacheBuster = `?t=${Date.now()}`;
            let response;

            if (isExport) {
                // Direct fetch for static export (avoids 404 on API)
                response = await fetch(`${basePath}/appointments.json${cacheBuster}`, { cache: 'no-store' });
            } else {
                // Try live API first locally
                response = await fetch(`${basePath}/api/appointments${cacheBuster}`, { cache: 'no-store' });
                if (!response.ok) {
                    response = await fetch(`${basePath}/appointments.json${cacheBuster}`, { cache: 'no-store' });
                }
            }

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

    // Initial fetch and periodic refresh
    useEffect(() => {
        if (!mounted) return;
        fetchAppointments();
        const refreshMs = settings.signageRefreshInterval * 60 * 1000;
        const refreshTimer = setInterval(fetchAppointments, refreshMs);
        return () => clearInterval(refreshTimer);
    }, [fetchAppointments, settings.signageRefreshInterval, mounted]);

    // Update clock
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(
                now.toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                })
            );
            setCurrentDate(
                now.toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                })
            );
        };
        updateTime();
        const clockTimer = setInterval(updateTime, 1000);
        return () => clearInterval(clockTimer);
    }, []);

    // Rotate visible appointments
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

    // Filter out appointments in the past
    const futureAppointments = useMemo(() =>
        filterPastAppointments(appointments),
        [appointments]);

    const visibleAppointments = futureAppointments.slice(
        visibleStart,
        visibleStart + VISIBLE_COUNT
    );

    return (
        <div className={styles.container}>
            {/* Animated background elements */}
            <div className={styles.backgroundOrbs}>
                <div className={styles.orb1} />
                <div className={styles.orb2} />
                <div className={styles.orb3} />
            </div>

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>
                        <Droplets size={48} />
                    </div>
                    <div className={styles.logoText}>
                        <h1>Beautykuppel Therme</h1>
                        <p>Bad Aibling</p>
                    </div>
                </div>
                <div className={styles.clockSection}>
                    <div className={styles.time}>{currentTime}</div>
                    <div className={styles.date}>{currentDate}</div>
                </div>
            </header>

            {/* Main content */}
            <main className={styles.main}>
                <div className={styles.titleSection}>
                    <Leaf className={styles.titleIcon} size={32} />
                    <h2>Freie Termine heute</h2>
                    <Leaf className={styles.titleIcon} size={32} />
                </div>

                <p className={styles.subtitle}>
                    Gönnen Sie sich eine Auszeit – fragen Sie an der Rezeption nach freien Terminen
                </p>

                {loading && appointments.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Sparkles size={64} className={styles.spinning} />
                        <p>Termine werden geladen...</p>
                    </div>
                ) : futureAppointments.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Sparkles size={64} />
                        <p>Aktuell sind keine freien Termine vorhanden.</p>
                    </div>
                ) : (
                    <div className={styles.appointmentsGrid}>
                        {visibleAppointments.map((apt, index) => (
                            <div
                                key={`${apt.date}-${apt.time}-${index}`}
                                className={styles.appointmentCard}
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                {apt.imageUrl && (
                                    <div
                                        className={styles.cardImage}
                                        style={{ width: `${settings.signageImageWidth}px`, minWidth: `${settings.signageImageWidth}px` }}
                                    >
                                        <img src={apt.imageUrl} alt={apt.treatment} />
                                    </div>
                                )}
                                <div className={styles.cardAccent} />
                                <div className={styles.cardContent}>
                                    <div className={styles.treatmentName}>{apt.treatment}</div>
                                    <div className={styles.appointmentDetails}>
                                        <div className={styles.timeSlot}>
                                            <span className={styles.timeLabel}>Uhrzeit</span>
                                            <span className={styles.timeValue}>{apt.time}</span>
                                        </div>
                                        <div className={styles.divider} />
                                        <div className={styles.priceSlot}>
                                            <span className={styles.priceLabel}>Preis</span>
                                            <span className={styles.priceValue}>{apt.price}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {appointments.length > VISIBLE_COUNT && (
                    <div className={styles.pagination}>
                        {Array.from({ length: Math.ceil(appointments.length / VISIBLE_COUNT) }).map((_, i) => (
                            <div
                                key={i}
                                className={`${styles.paginationDot} ${Math.floor(visibleStart / VISIBLE_COUNT) === i ? styles.active : ''
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <Sparkles size={24} />
                    <span>Fragen Sie unser Team an der Rezeption</span>
                    <Sparkles size={24} />
                </div>
            </footer>
        </div>
    );
}
