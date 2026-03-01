/**
 * Shared utility to filter out appointments that are in the past.
 * Handles German date formats (e.g., "Di, 13.01.2026" or "13.01.").
 */
export interface Appointment {
    date: string;
    time: string;
    [key: string]: any;
}

export function filterPastAppointments<T extends Appointment>(appointments: T[]): T[] {
    const now = new Date();

    return appointments.filter((apt) => {
        try {
            // 1. Try to parse with year (e.g., "13.01.2026")
            const dateWithYear = apt.date.match(/(\d{2})\.(\d{2})\.(\d{4})/);

            let day: number;
            let month: number;
            let year: number;

            if (dateWithYear) {
                day = parseInt(dateWithYear[1]);
                month = parseInt(dateWithYear[2]) - 1;
                year = parseInt(dateWithYear[3]);
            } else {
                // 2. Fallback to legacy format or missing year (e.g., "13.01.")
                const dateParts = apt.date.match(/(\d{2})\.(\d{2})\./);
                if (!dateParts) return true; // Keep if we can't parse it

                day = parseInt(dateParts[1]);
                month = parseInt(dateParts[2]) - 1;
                year = now.getFullYear();

                // Heuristic for year wrap if year is missing
                if (month < now.getMonth() - 6) {
                    year += 1;
                }
            }

            const [hours, minutes] = apt.time.split(':').map(Number);

            const aptDate = new Date();
            aptDate.setFullYear(year);
            aptDate.setMonth(month);
            aptDate.setDate(day);
            aptDate.setHours(hours, minutes, 0, 0);

            return aptDate >= now;
        } catch (e) {
            console.warn('Failed to parse appointment date:', apt.date, apt.time, e);
            return true; // Keep if error occurs to avoid missing potential valid slots
        }
    });
}
