import { Bookmarks } from '../components/bookmarks';
import { Calendar } from '../components/calendar';
import { Feed } from '../components/feed';
import { Markets } from '../components/markets';
import { Tasks } from '../components/tasks';

export function HomePage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="home" row />
      </div>
      <div className="grid">
        <Calendar />
        <Tasks />
        <Markets size="compact" />
        <Bookmarks bucket="home_grid" />
        <Feed limit={12} />
      </div>
    </>
  );
}
