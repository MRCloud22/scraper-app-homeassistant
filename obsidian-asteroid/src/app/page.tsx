'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import AppointmentCard from '@/components/AppointmentCard';
import { useSettings } from '@/context/SettingsContext';
import { filterPastAppointments } from '@/utils/filterAppointments';
import styles from './page.module.css';

interface Appointment {
  date: string;
  time: string;
  treatment: string;
  price: string;
  bookingUrl: string;
  imageUrl: string | null;
}


export default function Home() {
  const { settings } = useSettings();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering dynamic content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from the static JSON file (updated by the background sync service)
      const response = await fetch('appointments.json', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched data:', data);

      // Handle both wrapped {success: true, appointments: []} and raw [...] formats
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.success === false) {
          setError(data.error || 'Fehler beim Laden der Termine');
        } else {
          setAppointments(data.appointments || []);
          setLastUpdated(data.lastUpdated || null);
        }
      } else if (Array.isArray(data)) {
        // Fallback for raw array format
        setAppointments(data);
      } else {
        setError('Ungültiges Datenformat empfangen');
      }
    } catch (err) {
      setError(`Verbindung fehlgeschlagen: ${(err as Error).message}`);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Initial fetch and 60-second polling for live data
  useEffect(() => {
    if (!mounted) return;
    fetchAppointments();

    // Poll every 60 seconds
    const pollTimer = setInterval(fetchAppointments, 60000);
    return () => clearInterval(pollTimer);
  }, [fetchAppointments, mounted]);

  // Filter out appointments in the past
  const visibleAppointments = useMemo(() =>
    filterPastAppointments(appointments),
    [appointments]);

  const formatLastUpdated = (dateString: string) => {
    if (!mounted) return '';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoWrapper}>
            <Sparkles className={styles.logoIcon} size={32} />
            <h1 className={styles.title}>Beautykuppel Therme</h1>
          </div>
          <p className={styles.subtitle}>Freie Termine auf einen Blick</p>
        </div>

        <div className={styles.headerActions}>
          <nav className={styles.nav}>
            <a href="signage/" className={styles.navLink}>Signage</a>
            <a href="list/" className={styles.navLink}>Liste</a>
            <a href="settings/" className={styles.navLink}>Einstellungen</a>
          </nav>
          {lastUpdated && (
            <span className={styles.lastUpdated}>
              Aktualisiert: {formatLastUpdated(lastUpdated)}
            </span>
          )}
          <button
            onClick={fetchAppointments}
            className={styles.refreshButton}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? styles.spinning : ''} />
            <span>Aktualisieren</span>
          </button>
        </div>
      </header>

      {loading && (
        <div className={styles.loadingContainer}>
          <Loader2 size={48} className={styles.spinner} />
          <p>Termine werden geladen...</p>
        </div>
      )}

      {error && !loading && (
        <div className={styles.errorContainer}>
          <AlertCircle size={48} />
          <h2>Fehler beim Laden</h2>
          <p>{error}</p>
          <button onClick={fetchAppointments} className={styles.retryButton}>
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !error && visibleAppointments.length === 0 && (
        <div className={styles.emptyContainer}>
          <Sparkles size={48} />
          <h2>Keine Termine verfügbar</h2>
          <p>{settings.emptyStateText || 'Aktuell sind keine freien Termine vorhanden.'}</p>
        </div>
      )}

      {!loading && !error && visibleAppointments.length > 0 && (
        <>
          <div className={styles.statsBar}>
            <span className={styles.statsBadge}>
              {visibleAppointments.length} freie Termine gefunden
            </span>
          </div>

          <div className={styles.grid}>
            {visibleAppointments.map((appointment, index) => (
              <AppointmentCard
                key={`${appointment.date}-${appointment.time}-${index}`}
                {...appointment}
                index={index}
              />
            ))}
          </div>
        </>
      )}

      <footer className={styles.footer}>
        <p>
          Daten von{' '}
          <a
            href="https://shop.beautykuppel-therme-badaibling.de/"
            target="_blank"
            rel="noopener noreferrer"
          >
            shop.beautykuppel-therme-badaibling.de
          </a>
        </p>
      </footer>
    </main>
  );
}
