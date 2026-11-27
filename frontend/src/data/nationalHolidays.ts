export interface NationalHoliday {
  date: string;
  name: string;
}

export function getIndianNationalHolidays(year: number): NationalHoliday[] {
  const formatDate = (month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // India’s three statutory national holidays are joined by the major
  // public/festival holidays commonly included in corporate calendars.
  // Festival dates are kept per year because most follow the lunar calendar.
  const commonFestivalDates: Record<number, Array<[number, number, string]>> = {
    2025: [
      [1, 14, 'Makar Sankranti / Pongal'], [2, 26, 'Maha Shivratri'], [3, 14, 'Holi'],
      [3, 31, 'Eid al-Fitr'], [4, 10, 'Mahavir Jayanti'], [4, 18, 'Good Friday'],
      [5, 12, 'Buddha Purnima'], [6, 7, 'Bakrid'], [7, 6, 'Muharram'],
      [8, 16, 'Janmashtami'], [8, 27, 'Ganesh Chaturthi'], [9, 30, 'Dussehra'],
      [10, 20, 'Diwali'], [11, 5, 'Guru Nanak Jayanti'], [12, 25, 'Christmas Day'],
    ],
    2026: [
      [1, 14, 'Makar Sankranti / Pongal'], [2, 15, 'Maha Shivratri'], [3, 4, 'Holi'],
      [3, 20, 'Eid al-Fitr'], [3, 26, 'Ram Navami'], [3, 31, 'Mahavir Jayanti'],
      [4, 3, 'Good Friday'], [5, 1, 'Buddha Purnima'], [5, 27, 'Bakrid'],
      [6, 26, 'Muharram'], [9, 4, 'Janmashtami'], [9, 14, 'Ganesh Chaturthi'],
      [10, 20, 'Dussehra'], [11, 8, 'Diwali'], [11, 24, 'Guru Nanak Jayanti'],
      [12, 25, 'Christmas Day'],
    ],
    2027: [
      [1, 15, 'Makar Sankranti / Pongal'], [3, 6, 'Maha Shivratri'], [3, 22, 'Holi'],
      [3, 10, 'Eid al-Fitr'], [4, 15, 'Ram Navami'], [4, 19, 'Mahavir Jayanti'],
      [3, 26, 'Good Friday'], [5, 20, 'Buddha Purnima'], [5, 17, 'Bakrid'],
      [6, 16, 'Muharram'], [8, 25, 'Janmashtami'], [9, 4, 'Ganesh Chaturthi'],
      [10, 9, 'Dussehra'], [10, 29, 'Diwali'], [11, 14, 'Guru Nanak Jayanti'],
      [12, 25, 'Christmas Day'],
    ],
  };

  const fixedNationalHolidays: NationalHoliday[] = [
    { date: formatDate(1, 26), name: 'Republic Day' },
    { date: formatDate(8, 15), name: 'Independence Day' },
    { date: formatDate(10, 2), name: 'Gandhi Jayanti' },
  ];

  const festivalHolidays = (commonFestivalDates[year] ?? []).map(([month, day, name]) => ({
    date: formatDate(month, day),
    name,
  }));

  return [...fixedNationalHolidays, ...festivalHolidays].sort((a, b) => a.date.localeCompare(b.date));
}
