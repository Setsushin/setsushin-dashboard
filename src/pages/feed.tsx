import { Bookmarks } from '../components/bookmarks';
import { Digest } from '../components/digest';
import { Feed } from '../components/feed';

export function FeedPage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="feed" />
      </div>
      <div className="grid">
        <Feed size="wide" />
        <Digest />
      </div>
    </>
  );
}
