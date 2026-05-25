// Importing this barrel registers every widget type (each module calls
// registerWidget() as a load-time side effect). main.tsx imports it before
// first render so the registry is populated by the time App renders the grid.

import './agenda';
import './calendar';
import './tasks';
import './markets';
import './bookmarks';
import './feed';
import './assets';
import './journal';
import './profile';
