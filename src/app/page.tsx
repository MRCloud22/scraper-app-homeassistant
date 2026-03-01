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

interface ApiResponse {
  success: boolean;
  appointments: Appointment[];
  lastUpdated?: string;
  error?: string;
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

      const data: ApiResponse = await response.json();
      console.log('Fetched data:', data);

      if (data.success) {
        setAppointments(data.appointments);
        setLastUpdated(data.lastUpdated || null);
      } else {
        setError(data.error || 'Fehler beim Laden der Termine');
      }
    } catch (err) {
      setError('Verbindung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Periodic refresh
  useEffect(() => {
    if (!mounted) return;
    const intervalMs = settings.signageRefreshInterval * 60 * 1000;
    const timer = setInterval(fetchAppointments, intervalMs);
    return () => clearInterval(timer);
  }, [fetchAppointments, settings.signageRefreshInterval, mounted]);

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
          <p>Aktuell sind keine freien Termine vorhanden.</p>
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
