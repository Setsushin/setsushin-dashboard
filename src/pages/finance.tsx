import { Assets } from '../components/assets';
import { Bookmarks } from '../components/bookmarks';
import { Markets } from '../components/markets';
import { Tasks } from '../components/tasks';

export function FinancePage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="finance" row />
      </div>
      <div className="grid">
        <Assets />
        <Markets size="compact" />
        <Tasks size="compact" />
      </div>
    </>
  );
}
