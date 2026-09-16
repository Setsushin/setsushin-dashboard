import { Assets } from '../components/assets';
import { Bookmarks } from '../components/bookmarks';

export function FinancePage() {
  return (
    <>
      <div className="header-strip">
        <Bookmarks bucket="finance" />
      </div>
      <div className="grid">
        <Assets />
      </div>
    </>
  );
}
