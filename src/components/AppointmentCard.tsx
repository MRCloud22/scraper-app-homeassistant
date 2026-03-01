'use client';

import { Calendar, Clock, Euro, ExternalLink, Sparkles } from 'lucide-react';
import styles from './AppointmentCard.module.css';

interface AppointmentCardProps {
    date: string;
    time: string;
    treatment: string;
    price: string;
    bookingUrl: string;
    imageUrl?: string | null;
    index: number;
}

export default function AppointmentCard({
    date,
    time,
    treatment,
    price,
    bookingUrl,
    imageUrl,
    index,
}: AppointmentCardProps) {
    return (
        <div
            className={styles.card}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {imageUrl && (
                <div className={styles.cardImage}>
                    <img src={imageUrl} alt={treatment} />
                </div>
            )}
            <div className={styles.cardGlow} />
            <div className={styles.cardContent}>
                <div className={styles.treatmentHeader}>
                    <Sparkles className={styles.treatmentIcon} size={18} />
                    <h3 className={styles.treatmentName}>{treatment}</h3>
                </div>

                <div className={styles.details}>
                    <div className={styles.detailRow}>
                        <Calendar size={16} className={styles.detailIcon} />
                        <span>{date}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <Clock size={16} className={styles.detailIcon} />
                        <span>{time}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <Euro size={16} className={styles.detailIcon} />
                        <span className={styles.price}>{price}</span>
                    </div>
                </div>

                <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.bookButton}
                >
                    <span>Jetzt buchen</span>
                    <ExternalLink size={14} />
                </a>
            </div>
        </div>
    );
}
