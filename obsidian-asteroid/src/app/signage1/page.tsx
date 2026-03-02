'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Flower, QrCode } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './signage1.module.css';
import { filterPastAppointments } from '@/utils/filterAppointments';

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
    const [visibleStart, setVisibleStart] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const VISIBLE_COUNT = 3; // Circle design fits about 3-4 items comfortably

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
            {/* Header with Logo */}
            <header className={styles.header}>
                <div className={styles.logoIcon}>
                    <Flower size={80} color="#C5A059" />
                </div>
                <div className={styles.logoText}>
                    <h1>Beautykuppel</h1>
                    <p>Therme Bad Aibling</p>
                </div>
            </header>

            {/* Main Circle Content */}
            <main className={styles.main}>
                <div className={styles.circleContainer}>
                    <h2 className={styles.title}>Freie Termine heute</h2>

                    {loading && appointments.length === 0 ? (
                        <p>Laden...</p>
                    ) : futureAppointments.length === 0 ? (
                        <p className={styles.emptyState}>{settings.emptyStateText || 'Aktuell sind keine freien Termine vorhanden.'}</p>
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
                        <QrCode size={120} color="#5D7266" />
                        <span className={styles.qrText}>Hier buchen</span>
                    </div>
                    <div className={styles.infoCircle}>
                        Buchung direkt am Empfang
                    </div>
                </div>

                <div className={styles.mintCircle}>
                    <QrCode size={100} color="#5D7266" />
                    <span className={styles.qrText}>Infos unter<br />beautykuppel.de</span>
                </div>
            </footer>
        </div>
    );
}
