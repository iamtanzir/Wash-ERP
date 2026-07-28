import { useState, useEffect } from 'react';

let timeOffset = 0;
let hasFetchedOffset = false;

export const fetchTimeOffset = async () => {
  if (hasFetchedOffset) return;
  try {
    const res = await fetch('/api/time');
    if (res.ok) {
      const data = await res.json();
      const serverTime = data.time;
      timeOffset = serverTime - Date.now();
      hasFetchedOffset = true;
    }
  } catch (error) {
    console.warn("Failed to fetch server time, using local clock as fallback.");
  }
};

export const getRealTime = (timestamp?: number) => {
  return new Date((timestamp ?? Date.now()) + timeOffset);
};

export function useRealTimeClock() {
  const [time, setTime] = useState(getRealTime());

  useEffect(() => {
    fetchTimeOffset().then(() => {
      setTime(getRealTime());
    });

    const timer = setInterval(() => {
      setTime(getRealTime());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return time;
}

export const formatDhakaTime = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).formatToParts(date);
  
  let day = '', month = '', year = '', hour = '', minute = '', dayPeriod = '';
  for (const p of parts) {
    if (p.type === 'day') day = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'year') year = p.value;
    if (p.type === 'hour') hour = p.value;
    if (p.type === 'minute') minute = p.value;
    if (p.type === 'dayPeriod') dayPeriod = p.value;
  }
  return `${day} ${month.toUpperCase()} ${year} | ${hour}:${minute} ${dayPeriod.toUpperCase()}`;
};
