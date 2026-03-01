'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings, RotateCcw, Save, Image } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './settings.module.css';

export default function SettingsPage() {
    const { settings, updateSettings, resetSettings } = useSettings();
    const [imageWidth, setImageWidth] = useState(settings.signageImageWidth);
    const [rotationInterval, setRotationInterval] = useState(settings.signageRotationInterval);
    const [refreshInterval, setRefreshInterval] = useState(settings.signageRefreshInterval);
    const [emptyStateText, setEmptyStateText] = useState(settings.emptyStateText);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        updateSettings({
            signageImageWidth: imageWidth,
            signageRotationInterval: rotationInterval,
            signageRefreshInterval: refreshInterval,
            emptyStateText: emptyStateText
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        resetSettings();
        setImageWidth(140);
        setRotationInterval(8);
        setRefreshInterval(5);
        setEmptyStateText('Aktuell sind keine freien Termine vorhanden.');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/" className={styles.backLink}>
                    <ArrowLeft size={20} />
                    <span>Zurück</span>
                </Link>
                <div className={styles.headerTitle}>
                    <Settings size={28} />
                    <h1>Einstellungen</h1>
                </div>
            </header>

            <main className={styles.main}>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Image size={22} />
                        <h2>Bildanzeige</h2>
                    </div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingInfo}>
                            <label htmlFor="imageWidth" className={styles.settingLabel}>
                                Bildbreite (Signage)
                            </label>
                            <p className={styles.settingDescription}>
                                Breite der Behandlungsbilder in der Digital Signage Ansicht (in Pixel)
                            </p>
                        </div>
                        <div className={styles.settingControl}>
                            <input
                                type="range"
                                id="imageWidth"
                                min={80}
                                max={300}
                                step={10}
                                value={imageWidth}
                                onChange={(e) => setImageWidth(Number(e.target.value))}
                                className={styles.slider}
                            />
                            <div className={styles.sliderValue}>
                                <input
                                    type="number"
                                    value={imageWidth}
                                    onChange={(e) => setImageWidth(Number(e.target.value))}
                                    min={80}
                                    max={300}
                                    className={styles.numberInput}
                                />
                                <span>px</span>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className={styles.preview}>
                        <span className={styles.previewLabel}>Vorschau:</span>
                        <div
                            className={styles.previewBox}
                            style={{ width: `${imageWidth}px` }}
                        >
                            <div className={styles.previewImage} />
                            <span>{imageWidth}px</span>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Settings size={22} />
                        <h2>Signage Intervalle</h2>
                    </div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingInfo}>
                            <label htmlFor="rotationInterval" className={styles.settingLabel}>
                                Rotations-Intervall
                            </label>
                            <p className={styles.settingDescription}>
                                Wie lange eine Seite mit Terminen angezeigt wird (in Sekunden)
                            </p>
                        </div>
                        <div className={styles.settingControl}>
                            <input
                                type="range"
                                id="rotationInterval"
                                min={3}
                                max={30}
                                step={1}
                                value={rotationInterval}
                                onChange={(e) => setRotationInterval(Number(e.target.value))}
                                className={styles.slider}
                            />
                            <div className={styles.sliderValue}>
                                <input
                                    type="number"
                                    value={rotationInterval}
                                    onChange={(e) => setRotationInterval(Number(e.target.value))}
                                    min={3}
                                    max={30}
                                    className={styles.numberInput}
                                />
                                <span>s</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.settingItem} style={{ marginTop: '2rem' }}>
                        <div className={styles.settingInfo}>
                            <label htmlFor="refreshInterval" className={styles.settingLabel}>
                                Aktualisierungs-Intervall
                            </label>
                            <p className={styles.settingDescription}>
                                Wie oft neue Termine von der Webseite geladen werden (in Minuten)
                            </p>
                        </div>
                        <div className={styles.settingControl}>
                            <input
                                type="range"
                                id="refreshInterval"
                                min={1}
                                max={60}
                                step={1}
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                className={styles.slider}
                            />
                            <div className={styles.sliderValue}>
                                <input
                                    type="number"
                                    value={refreshInterval}
                                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                                    min={1}
                                    max={60}
                                    className={styles.numberInput}
                                />
                                <span>min</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <Settings size={22} />
                        <h2>Texte & Hinweise</h2>
                    </div>

                    <div className={styles.settingItem}>
                        <div className={styles.settingInfo}>
                            <label htmlFor="emptyStateText" className={styles.settingLabel}>
                                Hinweis bei keinen Terminen
                            </label>
                            <p className={styles.settingDescription}>
                                Dieser Text wird angezeigt, wenn keine freien Termine verfügbar sind.
                            </p>
                        </div>
                        <div className={styles.settingControl}>
                            <input
                                type="text"
                                id="emptyStateText"
                                value={emptyStateText}
                                onChange={(e) => setEmptyStateText(e.target.value)}
                                className={styles.textInput}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>
                    </div>
                </section>

                <div className={styles.actions}>
                    <button onClick={handleReset} className={styles.resetButton}>
                        <RotateCcw size={18} />
                        <span>Zurücksetzen</span>
                    </button>
                    <button onClick={handleSave} className={styles.saveButton}>
                        <Save size={18} />
                        <span>{saved ? 'Gespeichert!' : 'Speichern'}</span>
                    </button>
                </div>

                <div className={styles.links}>
                    <Link href="/signage" className={styles.pageLink}>
                        → Zur Signage Ansicht
                    </Link>
                </div>
            </main>
        </div>
    );
}
