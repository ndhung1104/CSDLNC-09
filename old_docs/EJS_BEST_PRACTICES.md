# EJS Best Practices & Usage Guide

## Quick Reference

### 1. Creating a New Page

**Step 1: Create Route** (`src/routes/customer.route.js`)
```javascript
router.get('/new-page', (_req, res) => {
  const data = getPageData(); // Get data from service
  res.render('customer/new-page', {
    title: 'New Page',
    ...data,
  });
});
```

**Step 2: Create View** (`src/views/customer/new-page.ejs`)
```ejs
<%- include('../layouts/layout-customer') %>

<section class="py-4">
  <div class="container">
    <h2><%= title %></h2>
    <!-- Your content here -->
  </div>
</section>
```

---

### 2. Using Partials

#### Include a Partial
```ejs
<%- include('../partials/customer/navbar') %>
```

#### Pass Data to Partial
```ejs
<%- include('../partials/customer/pet-card', { pet: pet }) %>
```

#### Create a New Partial
1. Create file: `src/views/partials/customer/pet-card.ejs`
2. Add content:
```ejs
<div class="card">
  <h5><%= pet.name %></h5>
  <p><%= pet.breed %></p>
</div>
```
3. Use in pages:
```ejs
<%- include('../partials/customer/pet-card', { pet: myPet }) %>
```

---

### 3. Common Patterns

#### Conditional Rendering
```ejs
<% if (typeof user !== 'undefined' && user) { %>
  <p>Welcome, <%= user.name %></p>
<% } else { %>
  <p>Please log in</p>
<% } %>
```

#### Array Iteration
```ejs
<% if (typeof items !== 'undefined' && items && items.length > 0) { %>
  <% items.forEach((item, index) => { %>
    <div><%= item.name %></div>
  <% }); %>
<% } else { %>
  <p>No items found</p>
<% } %>
```

#### Ternary Operations
```ejs
<p class="<%= status === 'active' ? 'text-success' : 'text-danger' %>">
  <%= status %>
</p>
```

#### Date Formatting
```ejs
<!-- Full format -->
<%= new Date(date).toLocaleDateString('en-US', { 
  month: 'long', 
  day: 'numeric', 
  year: 'numeric' 
}) %>

<!-- Short format -->
<%= new Date(date).toLocaleDateString('en-US', { 
  month: 'short', 
  day: 'numeric', 
  year: 'numeric' 
}) %>

<!-- Time -->
<%= new Date(date).toLocaleTimeString('en-US', { 
  hour: '2-digit', 
  minute: '2-digit' 
}) %>
```

#### String Operations
```ejs
<!-- Substring -->
<%= text.substring(0, 20) %><% if (text.length > 20) { %>...<%  } %>

<!-- Uppercase -->
<%= text.toUpperCase() %>

<!-- Lowercase -->
<%= text.toLowerCase() %>

<!-- Replace -->
<%= text.replace(/old/g, 'new') %>
```

---

### 4. Safe Data Access

Always check for undefined variables:

```ejs
<!-- Bad - will throw error if variable is undefined -->
<%= user.name %>

<!-- Good - safely access with fallback -->
<%= typeof user !== 'undefined' && user ? user.name : 'Guest' %>

<!-- Or use optional chaining (if supported) -->
<%= user?.name ?? 'Guest' %>

<!-- For complex objects -->
<%= typeof data !== 'undefined' && data && data.nested ? data.nested.value : 'Default' %>
```

---

### 5. Dynamic Classes and Attributes

```ejs
<!-- Dynamic class binding -->
<div class="alert <%= status === 'error' ? 'alert-danger' : 'alert-success' %>">
  Message
</div>

<!-- Multiple conditions -->
<button class="btn <%= 
  isActive ? 'btn-primary' : 
  isDisabled ? 'btn-secondary disabled' : 
  'btn-outline-primary' 
%>">
  Click me
</button>

<!-- Dynamic attributes -->
<input type="text" <%= required ? 'required' : '' %>>
```

---

### 6. Loops with Index

```ejs
<% items.forEach((item, index) => { %>
  <tr>
    <td><%= index + 1 %></td>
    <td><%= item.name %></td>
  </tr>
<% }); %>
```

---

### 7. Working with Booleans

```ejs
<!-- Check boolean directly -->
<% if (isActive) { %>
  <span class="badge bg-success">Active</span>
<% } else { %>
  <span class="badge bg-secondary">Inactive</span>
<% } %>

<!-- Ternary operator -->
<span><%= isActive ? 'Yes' : 'No' %></span>

<!-- Negation -->
<% if (!isDeleted) { %>
  <button>Delete</button>
<% } %>
```

---

### 8. Calculations and Filters

```ejs
<!-- Math operations -->
<p>Total: $<%= items.reduce((sum, item) => sum + item.price, 0) %></p>

<!-- String length -->
<p>Characters: <%= text.length %></p>

<!-- Filter array -->
<% const active = items.filter(i => i.isActive); %>
<p><%= active.length %> active items</p>

<!-- Map array -->
<% const names = items.map(i => i.name); %>
```

---

### 9. Forms

```ejs
<!-- Form with method override if needed -->
<form action="/customer/update" method="POST">
  <div class="mb-3">
    <label for="name" class="form-label">Name</label>
    <input 
      type="text" 
      class="form-control" 
      id="name" 
      name="name" 
      value="<%= typeof user !== 'undefined' && user ? user.name : '' %>"
      required
    >
  </div>
  
  <!-- Checkbox -->
  <div class="form-check">
    <input 
      type="checkbox" 
      class="form-check-input" 
      id="remember" 
      name="remember"
      <%= remember ? 'checked' : '' %>
    >
    <label class="form-check-label" for="remember">Remember me</label>
  </div>
  
  <!-- Select dropdown -->
  <select class="form-select" name="status">
    <option value="active" <%= status === 'active' ? 'selected' : '' %>>Active</option>
    <option value="inactive" <%= status === 'inactive' ? 'selected' : '' %>>Inactive</option>
  </select>
  
  <button type="submit" class="btn btn-primary">Submit</button>
</form>
```

---

### 10. Comments

```ejs
<!-- HTML comment visible in source -->
<!-- This is visible -->

<!-- EJS comment not visible in source -->
<%# This is hidden %>
```

---

## File Organization Tips

### Partial Naming Convention
- `_component-name.ejs` - Small reusable components
- `partial-name.ejs` - Larger partial sections
- Store by feature: `partials/customer/`, `partials/management/`, `partials/common/`

### View Naming Convention
- `page-name.ejs` - Main page views
- Use hyphens for multi-word names
- Organize in folders by feature/section

### Routes Naming Convention
- `feature.route.js` - Route files
- Services: `feature.service.js`
- Controllers: `feature.controller.js` (if added later)

---

## Debugging Tips

### 1. Check Template Variables
```ejs
<!-- Temporary debug output -->
<pre><%= JSON.stringify(data, null, 2) %></pre>

<!-- Check specific variable -->
<p><%= typeof user %></p> <!-- Will show "object", "string", "undefined" -->
```

### 2. Console Logging (Server-side)
```javascript
// In route file
router.get('/page', (req, res) => {
  const data = getData();
  console.log('Data:', data); // View in terminal/server logs
  res.render('page', data);
});
```

### 3. Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `user is not defined` | Variable passed incorrectly | Check route res.render() data |
| `Cannot read property 'name' of undefined` | Accessing property of undefined | Use safe access: `user?.name ?? 'default'` |
| `Unexpected token` | Syntax error in template | Check for missing quotes, brackets |
| White blank page | Missing layout include | Add `<%- include('../layouts/...') %>` at top |

---

## Migration Checklist for New Features

When adding a new feature:

- [ ] Create `.route.js` file in `routes/`
- [ ] Create `.service.js` file in `services/` (if needed)
- [ ] Create view files in `views/feature/`
- [ ] Create partials in `views/partials/feature/` (if needed)
- [ ] Include layout at top of view: `<%- include('../layouts/layout-...') %>`
- [ ] Pass data from route to view
- [ ] Test variable access with safe checks
- [ ] Add to appropriate sidebar/navbar (create partial if needed)
- [ ] Style with Bootstrap classes or custom CSS

---

## Performance Tips

1. **Don't Fetch in Views** - Get data from services/controllers
2. **Use Partials for Reuse** - Don't duplicate HTML
3. **Minimize Inline Scripts** - Use external JS files
4. **Cache Static Files** - Configure CDN for CSS/JS
5. **Lazy Load Images** - Use `loading="lazy"` attribute
6. **Minimize Calculations** - Do complex logic in routes/services

---

## Security Reminders

1. **Always Escape User Input** - Use `<%=` (not `<%-`)
2. **Validate Server-Side** - Never trust client data
3. **Use CSRF Protection** - Add middleware for forms
4. **Sanitize HTML** - Use libraries like `xss` if needed
5. **Never Log Sensitive Data** - Don't console.log passwords

---

Happy coding! 🚀
