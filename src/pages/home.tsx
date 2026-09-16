import { Bookmarks } from '../components/bookmarks';
import { Calendar } from '../components/calendar';
import { Markets } from '../components/markets';
import { Tasks } from '../components/tasks';

export function HomePage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="home" />
      </div>
      <div className="grid">
        <Calendar />
        <Tasks />
        <Markets />
      </div>
    </>
  );
}
