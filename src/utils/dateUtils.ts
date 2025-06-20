export const formatTime = (hours: number, minutes: number): string => {
  const h = Math.floor(hours);
  const m = Math.floor(minutes);
  return `${h}:${m.toString().padStart(2, '0')}`;
};

export const formatTimeFromMinutes = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return formatTime(hours, minutes);
};

export const formatHoursMinutes = (totalHours: number): string => {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours % 1) * 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
};

export const formatHoursMinutesShort = (totalHours: number): string => {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours % 1) * 60);
  if (hours === 0) {
    return `${minutes}min`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}min`;
};

export const getTotalMinutes = (hours: number, minutes: number): number => {
  return hours * 60 + minutes;
};

export const getTimerDisplay = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const isFieldServiceDay = (date: Date, fieldServiceDays: number[]): boolean => {
  return fieldServiceDays.includes(date.getDay());
};

export const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
};

export const getMonthName = (monthString: string): string => {
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month - 1, 1).getDay();
};