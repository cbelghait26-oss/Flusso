import type { LocalEvent, YMD } from "../components/calendar/types";

// Calculate Easter Sunday using Computus algorithm (Anonymous Gregorian algorithm)
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Calculate Chinese New Year (approximate based on known dates)
function calculateChineseNewYear(year: number): Date {
  // Chinese New Year dates for recent/upcoming years
  const knownDates: { [key: number]: [number, number] } = {
    2024: [1, 10],  // Feb 10, 2024
    2025: [0, 29],  // Jan 29, 2025
    2026: [1, 17],  // Feb 17, 2026
    2027: [1, 6],   // Feb 6, 2027
    2028: [0, 26],  // Jan 26, 2028
    2029: [1, 13],  // Feb 13, 2029
    2030: [1, 3],   // Feb 3, 2030
  };
  
  if (knownDates[year]) {
    const [month, day] = knownDates[year];
    return new Date(year, month, day);
  }
  
  // Fallback to approximate calculation (between Jan 21 and Feb 20)
  return new Date(year, 1, 1); // Default to Feb 1
}

// Calculate Ramadan start (approximate - Islamic lunar calendar)
function calculateRamadanStart(year: number): Date {
  // Ramadan moves back ~11 days each year. Known dates:
  const knownDates: { [key: number]: [number, number] } = {
    2024: [2, 11],  // Mar 11, 2024
    2025: [2, 1],   // Mar 1, 2025
    2026: [1, 18],  // Feb 18, 2026
    2027: [1, 8],   // Feb 8, 2027
    2028: [0, 28],  // Jan 28, 2028
    2029: [0, 17],  // Jan 17, 2029
    2030: [0, 6],   // Jan 6, 2030
  };
  
  if (knownDates[year]) {
    const [month, day] = knownDates[year];
    return new Date(year, month, day);
  }
  
  return new Date(year, 2, 1); // Default to March 1
}

// Calculate Eid al-Fitr (end of Ramadan, ~30 days after Ramadan start)
function calculateEidAlFitr(year: number): Date {
  const ramadanStart = calculateRamadanStart(year);
  const eidDate = new Date(ramadanStart);
  eidDate.setDate(eidDate.getDate() + 30);
  return eidDate;
}

// Calculate Eid al-Adha (~70 days after Eid al-Fitr)
function calculateEidAlAdha(year: number): Date {
  const knownDates: { [key: number]: [number, number] } = {
    2024: [5, 17],  // Jun 17, 2024
    2025: [5, 6],   // Jun 6, 2025
    2026: [4, 27],  // May 27, 2026
    2027: [4, 16],  // May 16, 2027
    2028: [4, 5],   // May 5, 2028
    2029: [3, 24],  // Apr 24, 2029
    2030: [3, 13],  // Apr 13, 2030
  };
  
  if (knownDates[year]) {
    const [month, day] = knownDates[year];
    return new Date(year, month, day);
  }
  
  return new Date(year, 5, 15); // Default to June 15
}

// Calculate Hanukkah (approximate - Hebrew calendar)
function calculateHanukkah(year: number): Date {
  const knownDates: { [key: number]: [number, number] } = {
    2024: [11, 26], // Dec 26, 2024
    2025: [11, 15], // Dec 15, 2025
    2026: [11, 5],  // Dec 5, 2026
    2027: [11, 25], // Dec 25, 2027
    2028: [11, 13], // Dec 13, 2028
    2029: [11, 2],  // Dec 2, 2029
    2030: [11, 21], // Dec 21, 2030
  };
  
  if (knownDates[year]) {
    const [month, day] = knownDates[year];
    return new Date(year, month, day);
  }
  
  return new Date(year, 11, 15); // Default to Dec 15
}

// Calculate Yom Kippur (approximate - 10 days after Rosh Hashanah)
function calculateYomKippur(year: number): Date {
  const knownDates: { [key: number]: [number, number] } = {
    2024: [9, 12],  // Oct 12, 2024
    2025: [9, 2],   // Oct 2, 2025
    2026: [8, 23],  // Sep 23, 2026
    2027: [9, 12],  // Oct 12, 2027
    2028: [9, 1],   // Oct 1, 2028
    2029: [8, 20],  // Sep 20, 2029
    2030: [9, 9],   // Oct 9, 2030
  };
  
  if (knownDates[year]) {
    const [month, day] = knownDates[year];
    return new Date(year, month, day);
  }
  
  return new Date(year, 9, 10); // Default to Oct 10
}

function dateToYMD(date: Date): YMD {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateHolidaysForYear(year: number): LocalEvent[] {
  const holidays: LocalEvent[] = [];
  
  // Fixed date holidays
  const fixedHolidays = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 1, day: 14, name: "Valentine's Day" },
    { month: 11, day: 24, name: "Christmas Eve" },
    { month: 11, day: 25, name: "Christmas Day" },
  ];
  
  fixedHolidays.forEach(({ month, day, name }) => {
    const date = new Date(year, month, day);
    holidays.push({
      id: `holiday_${year}_${name.replace(/\s+/g, '_').toLowerCase()}`,
      title: name,
      allDay: true,
      startDate: dateToYMD(date),
      startTime: "00:00",
      endDate: dateToYMD(date),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Public Holiday",
    });
  });
  
  // Calculated holidays
  try {
    const easter = calculateEaster(year);
    holidays.push({
      id: `holiday_${year}_easter`,
      title: "Easter Sunday",
      allDay: true,
      startDate: dateToYMD(easter),
      startTime: "00:00",
      endDate: dateToYMD(easter),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Christian Holiday",
    });
  } catch (e) {
    console.error("Failed to calculate Easter:", e);
  }
  
  try {
    const chineseNewYear = calculateChineseNewYear(year);
    holidays.push({
      id: `holiday_${year}_chinese_new_year`,
      title: "Chinese New Year",
      allDay: true,
      startDate: dateToYMD(chineseNewYear),
      startTime: "00:00",
      endDate: dateToYMD(chineseNewYear),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Lunar New Year",
    });
  } catch (e) {
    console.error("Failed to calculate Chinese New Year:", e);
  }
  
  try {
    const ramadan = calculateRamadanStart(year);
    holidays.push({
      id: `holiday_${year}_ramadan`,
      title: "Ramadan Begins",
      allDay: true,
      startDate: dateToYMD(ramadan),
      startTime: "00:00",
      endDate: dateToYMD(ramadan),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Islamic Holy Month",
    });
  } catch (e) {
    console.error("Failed to calculate Ramadan:", e);
  }
  
  try {
    const eidFitr = calculateEidAlFitr(year);
    holidays.push({
      id: `holiday_${year}_eid_fitr`,
      title: "Eid al-Fitr",
      allDay: true,
      startDate: dateToYMD(eidFitr),
      startTime: "00:00",
      endDate: dateToYMD(eidFitr),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Islamic Holiday",
    });
  } catch (e) {
    console.error("Failed to calculate Eid al-Fitr:", e);
  }
  
  try {
    const eidAdha = calculateEidAlAdha(year);
    holidays.push({
      id: `holiday_${year}_eid_adha`,
      title: "Eid al-Adha",
      allDay: true,
      startDate: dateToYMD(eidAdha),
      startTime: "00:00",
      endDate: dateToYMD(eidAdha),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Islamic Holiday",
    });
  } catch (e) {
    console.error("Failed to calculate Eid al-Adha:", e);
  }
  
  try {
    const hanukkah = calculateHanukkah(year);
    holidays.push({
      id: `holiday_${year}_hanukkah`,
      title: "Hanukkah",
      allDay: true,
      startDate: dateToYMD(hanukkah),
      startTime: "00:00",
      endDate: dateToYMD(hanukkah),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Jewish Holiday",
    });
  } catch (e) {
    console.error("Failed to calculate Hanukkah:", e);
  }
  
  try {
    const yomKippur = calculateYomKippur(year);
    holidays.push({
      id: `holiday_${year}_yom_kippur`,
      title: "Yom Kippur",
      allDay: true,
      startDate: dateToYMD(yomKippur),
      startTime: "00:00",
      endDate: dateToYMD(yomKippur),
      endTime: "23:59",
      color: "purple",
      reminder: "none",
      calendarSource: "local",
      eventType: "event",
      notes: "Jewish Holiday",
    });
  } catch (e) {
    console.error("Failed to calculate Yom Kippur:", e);
  }
  
  return holidays;
}

// Generate holidays for current year and next year
export function generateDefaultHolidays(): LocalEvent[] {
  const currentYear = new Date().getFullYear();
  const holidays = [
    ...generateHolidaysForYear(currentYear),
    ...generateHolidaysForYear(currentYear + 1),
  ];
  return holidays;
}
