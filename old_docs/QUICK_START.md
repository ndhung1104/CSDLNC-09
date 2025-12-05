# PetCareX Quick Start Guide

## Project Structure After Refactoring

```
src/
├── app.js                          # Express app with EJS configuration
├── package.json                    # Dependencies (now uses EJS)
├── Dockerfile                      # Container configuration
├── routes/
│   ├── customer.route.js          # Customer portal routes
│   └── management.route.js        # Management portal routes
├── services/
│   └── demoData.service.js        # Demo data service
├── public/
│   ├── css/
│   │   ├── customer-styles.css
│   │   └── management-styles.css
│   └── js/
│       ├── customer-scripts.js
│       └── management-scripts.js
└── views/
    ├── layouts/
    │   ├── layout-customer.ejs       # Base layout for customer portal
    │   └── layout-management.ejs     # Base layout for management portal
    ├── partials/
    │   ├── common/
    │   │   ├── head.ejs              # Meta tags and CSS
    │   │   └── scripts.ejs           # Bootstrap JS
    │   ├── customer/
    │   │   ├── navbar.ejs            # Customer navigation
    │   │   └── footer.ejs            # Customer footer
    │   └── management/
    │       ├── navbar.ejs            # Management navigation
    │       ├── sidebar.ejs           # Desktop sidebar
    │       └── mobile-sidebar.ejs    # Mobile offcanvas menu
    ├── customer/                     # Customer page views
    │   ├── home.ejs
    │   ├── login.ejs
    │   ├── dashboard.ejs
    │   ├── appointments.ejs
    │   ├── appointment-new.ejs
    │   ├── pets.ejs
    │   └── receipts.ejs
    └── management/                   # Management page views
        ├── dashboard.ejs
        └── customers.ejs
```

---

## Key Changes

### 1. Files Renamed
- `routes/customer.js` → `routes/customer.route.js`
- `routes/management.js` → `routes/management.route.js`
- `services/demoData.js` → `services/demoData.service.js`

### 2. Template Engine
- **Before:** Handlebars (`.hbs`)
- **After:** EJS (`.ejs`)
- **Dependency:** `express-handlebars` → `ejs`

### 3. Layout System
- Each view file now explicitly includes its layout at the top
- Layouts include partials for navbar, footer, sidebars, etc.
- Removes need for layout property in res.render()

---

## Installation & Setup

### Install Dependencies
```bash
cd src
npm install
```

### Run Development Server
```bash
npm run dev
```

The server will start on `http://localhost:54321`

### Default URLs
- **Customer Portal:** `http://localhost:54321/customer/dashboard`
- **Management Portal:** `http://localhost:54321/management/dashboard`

---

## File Naming Conventions

### Routes
- Pattern: `{feature}.route.js`
- Examples: `customer.route.js`, `management.route.js`

### Services
- Pattern: `{feature}.service.js`
- Examples: `demoData.service.js`, `user.service.js`

### Views (Pages)
- Pattern: `{page-name}.ejs`
- Examples: `home.ejs`, `dashboard.ejs`

### Partials (Reusable Components)
- Pattern: `{component-name}.ejs`
- Examples: `navbar.ejs`, `footer.ejs`

---

## Creating a New Page

### Step 1: Create Route
**File:** `src/routes/customer.route.js`
```javascript
router.get('/new-page', (_req, res) => {
  const data = getNewPageData(); // from service
  res.render('customer/new-page', {
    title: 'New Page',
    ...data
  });
});
```

### Step 2: Create View
**File:** `src/views/customer/new-page.ejs`
```ejs
<%- include('../layouts/layout-customer') %>

<section class="py-4">
  <div class="container">
    <h2><%= title %></h2>
    <!-- Your content here -->
  </div>
</section>
```

That's it! The layout, navbar, and footer are automatically included.

---

## Creating a Reusable Partial

### Step 1: Create Partial File
**File:** `src/views/partials/customer/pet-card.ejs`
```ejs
<div class="card">
  <div class="card-body text-center">
    <h5 class="card-title"><%= pet.name %></h5>
    <p class="text-muted"><%= pet.breed %></p>
  </div>
</div>
```

### Step 2: Use in Views
```ejs
<%- include('../partials/customer/pet-card', { pet: myPet }) %>
```

---

## Common EJS Syntax

### Output Variable
```ejs
<%= variable %>           <!-- Escaped -->
<%- htmlContent %>        <!-- Unescaped (for HTML) -->
```

### JavaScript Code
```ejs
<% code here; %>          <!-- Execute code -->
<%# comment here %>       <!-- Comment (hidden) -->
```

### Conditional
```ejs
<% if (condition) { %>
  <p>True</p>
<% } %>
```

### Loop
```ejs
<% items.forEach((item) => { %>
  <li><%= item.name %></li>
<% }); %>
```

### Include Partial
```ejs
<%- include('../partials/component') %>
<%- include('../partials/component', { data: value }) %>
```

---

## Data Flow

```
Route Handler (customer.route.js)
    ↓
Calls Service (demoData.service.js)
    ↓
Passes Data to View (customer/page.ejs)
    ↓
View Includes Layout (layouts/layout-customer.ejs)
    ↓
Layout Includes Partials (partials/...)
    ↓
HTML Rendered to Browser
```

### Example
```javascript
// Route: src/routes/customer.route.js
router.get('/dashboard', (_req, res) => {
  const data = getCustomerDashboardData();
  res.render('customer/dashboard', {
    title: 'Dashboard',
    ...data
  });
});
```

```ejs
<!-- View: src/views/customer/dashboard.ejs -->
<%- include('../layouts/layout-customer') %>
<!-- layouts/layout-customer.ejs automatically includes: -->
<!--   - partials/common/head.ejs -->
<!--   - partials/customer/navbar.ejs -->
<!--   - partials/customer/footer.ejs -->
<!--   - partials/common/scripts.ejs -->

<section class="py-4">
  <h2><%= title %></h2>
  <h3>Welcome, <%= customer.name %>!</h3>
</section>
```

---

## Useful Links

### EJS Documentation
- [EJS Official Docs](https://ejs.co/)
- [EJS Syntax Reference](https://ejs.co/#docs)

### Bootstrap
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [Bootstrap Icons](https://icons.getbootstrap.com/)

### Express
- [Express Docs](https://expressjs.com/)

---

## Troubleshooting

### Page Shows Blank
- **Check:** Does the view include the layout?
- **Fix:** Add `<%- include('../layouts/layout-...') %>` at the top

### Variable Not Displaying
- **Check:** Is it passed from the route?
- **Check:** Is it using `<%= variable %>` not `{{ variable }}`?

### Partial Not Loading
- **Check:** Is the path correct?
- **Check:** Is the file extension `.ejs`?
- **Fix:** Use `<%- include('../path/to/partial') %>`

### Styles Not Showing
- **Check:** Are CSS files linked in common/head.ejs?
- **Check:** Is `/public/css/` the correct path?

---

## Documentation Files

This project includes two additional guides:

1. **REFACTORING_SUMMARY.md** - Details of all changes made
2. **EJS_BEST_PRACTICES.md** - Advanced EJS patterns and tips

---

## Next Steps

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Visit `http://localhost:54321/customer/dashboard`
4. Explore the code structure
5. Create new pages following the patterns above

---

**Happy Coding! 🎉**
