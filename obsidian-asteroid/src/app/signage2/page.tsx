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

export default function Signage2Page() {
    const { settings } = useSettings();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [visibleStart, setVisibleStart] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const VISIBLE_COUNT = 5; // Pill design fits about 5 items comfortably

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

    useEffect(() => {
        if (!mounted) return;
        fetchAppointments();
        const pollTimer = setInterval(fetchAppointments, 60000);
        return () => clearInterval(pollTimer);
    }, [fetchAppointments, mounted]);

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

    return (
        <div className={styles.container}>
            {/* Background Decorations */}
            <div className={styles.backgroundDecor} />
            <div className={styles.backgroundDecor2} />

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.logoIcon}>
                    <Flower size={60} color="#C5A059" />
                </div>
                <div className={styles.logoText}>
                    <h1>Beautykuppel</h1>
                    <p>Therme Bad Aibling</p>
                </div>
            </header>

            {/* Main Content */}
            <main className={styles.main}>
                <h2 className={styles.title}>Freie Termine heute</h2>

                {loading && appointments.length === 0 ? (
                    <div className={styles.emptyState}>Laden...</div>
                ) : futureAppointments.length === 0 ? (
                    <div className={styles.emptyState}>{settings.emptyStateText || 'Aktuell sind keine freien Termine vorhanden.'}</div>
                ) : (
                    <div className={styles.appointmentList}>
                        {visibleAppointments.map((apt, index) => (
                            <div
                                key={`${apt.date}-${apt.time}-${index}`}
                                className={styles.appointmentPill}
                                style={{ animationDelay: `${index * 0.15}s` }}
                            >
                                <div className={styles.pillImage}>
                                    {apt.imageUrl ? (
                                        <img src={apt.imageUrl} alt={apt.treatment} />
                                    ) : (
                                        <div style={{ backgroundColor: '#D6E3D8', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Flower color="#5D7266" size={40} />
                                        </div>
                                    )}
                                </div>
                                <div className={styles.pillContent}>
                                    <div className={styles.time}>{apt.time} Uhr</div>
                                    <div className={styles.treatment}>{apt.treatment}</div>
                                </div>
                                <div className={styles.price}>{apt.price}</div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.qrSection}>
                    <div className={styles.qrInfoText}>Infos & Buchung unter<br />beautykuppel.de/termine</div>
                    <div className={styles.qrContainer}>
                        <QrCode size={100} color="#5D7266" />
                    </div>
                </div>
            </footer>
        </div>
    );
}
