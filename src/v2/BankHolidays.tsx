import { useEffect } from 'react';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineActions } from '../actions/timelineActions';

export const BankHolidays: React.FC = () => {
  const { dispatch } = useTimeline();

  useEffect(() => {
    fetch('https://www.gov.uk/bank-holidays.json')
      .then(res => res.json())
      .then(data => {
        const events = data['england-and-wales']?.events || [];
        const now = new Date();
        const tenYears = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
        const holidays: string[] = events
          .map((e: any) => e.date)
          .filter((d: string) => {
            const dt = new Date(d);
            return dt >= now && dt <= tenYears;
          });
        dispatch(TimelineActions.setBankHolidays(holidays));
      })
      .catch(() => dispatch(TimelineActions.setBankHolidays([])));
  }, [dispatch]);

  return null;
};

export default BankHolidays;

