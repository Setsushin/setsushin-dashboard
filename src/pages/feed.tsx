import { Bookmarks } from '../components/bookmarks';
import { Calendar } from '../components/calendar';
import { Feed } from '../components/feed';
import { Tasks } from '../components/tasks';

export function FeedPage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="feed" row />
      </div>
      <div className="grid">
        <Feed columns perSource={6} />
        <Bookmarks bucket="feed_grid" />
        <Calendar size="compact" />
        <Tasks size="compact" />
      </div>
    </>
  );
}
