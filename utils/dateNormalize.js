/**
 * Unit-style fixtures:
 * - "2026-05-01" -> "2026-05-01"
 * - "2026-5-1" -> "2026-05-01"
 * - "2026-05-01T00:00:00.000Z" -> "2026-05-01"
 * - "2026-05-01T23:30:00.000Z" -> "2026-05-02"
 * - "May 1, 2026" -> "2026-05-01"
 * - "5/1/2026" -> "2026-05-01"
 * - "invalid" -> null
 */

const TOKYO_TIME_ZONE = 'Asia/Tokyo';
const TOKYO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

function pad2(value) {
    return String(value).padStart(2, '0');
}

function isValidYMD(year, month, day) {
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    const parsedDay = Number(day);

    if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || !Number.isInteger(parsedDay)) {
        return false;
    }

    const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));
    return date.getUTCFullYear() === parsedYear &&
        date.getUTCMonth() === parsedMonth - 1 &&
        date.getUTCDate() === parsedDay;
}

function formatYMD(year, month, day) {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatDateInTokyo(date) {
    const parts = TOKYO_FORMATTER.formatToParts(date);
    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;

    if (!year || !month || !day) {
        return null;
    }

    return `${year}-${month}-${day}`;
}

function normalizeDate(input) {
    if (typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }

    const isoDateOnlyMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoDateOnlyMatch) {
        const [, year, month, day] = isoDateOnlyMatch;
        return isValidYMD(year, month, day) ? formatYMD(year, month, day) : null;
    }

    const isoDatePrefixMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*|Z)$/i);
    if (isoDatePrefixMatch && /[T\s]|Z/i.test(trimmed)) {
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : formatDateInTokyo(parsed);
    }

    const slashDateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashDateMatch) {
        const [, month, day, year] = slashDateMatch;
        return isValidYMD(year, month, day) ? formatYMD(year, month, day) : null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return formatDateInTokyo(parsed);
}

function isSameDay(a, b) {
    const normalizedA = normalizeDate(a);
    const normalizedB = normalizeDate(b);
    return normalizedA !== null && normalizedA === normalizedB;
}

module.exports = {
    normalizeDate,
    isSameDay
};
