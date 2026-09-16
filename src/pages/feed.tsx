import { Bookmarks } from '../components/bookmarks';
import { Feed } from '../components/feed';
import { Markets } from '../components/markets';

export function FeedPage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="feed" />
      </div>
      <div className="grid">
        <Feed size="wide" />
        <Markets />
      </div>
    </>
  );
}
