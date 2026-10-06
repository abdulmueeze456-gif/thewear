import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

(() => {
  let products = [];
  let orders = [];
  let customerRecords = [];
  let customerSummaries = [];
  let activeOrder = null;
  let activeCustomer = null;
  const localProductImages = [
    "assets/products/cap-01.png",
    "assets/products/cap-02.png",
    "assets/products/cap-03.png",
    "assets/products/cap-04.png"
  ];

  const $ = selector => document.querySelector(selector);
  const money = value => `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const dash = "—";

  function dateValue(value) {
    if (!value) return null;
    try {
      if (typeof value.toDate === "function") return value.toDate();
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch { return null; }
  }

  function formatDate(value) {
    const date = dateValue(value);
    return date ? date.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" }) : dash;
  }

  function formatOrderDate(value) {
    const date = dateValue(value);
    if (!date) return dash;
    return date.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true
    }).replace(/\b(am|pm)\b/i, match => match.toUpperCase());
  }

  function amountOrDash(value) {
    return value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
      ? dash
      : money(value);
  }

  function phoneLinks(value) {
    const phone = String(value || "").trim();
    const digits = phone.replace(/\D/g, "");
    if (!phone || !digits) return dash;
    const whatsappDigits = phone.startsWith("+") || digits.startsWith("92")
      ? digits
      : /^0\d{10}$/.test(digits) ? `92${digits.slice(1)}` : "";
    const whatsapp = whatsappDigits ? `<a href="https://wa.me/${whatsappDigits}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : "";
    return `<span class="phone-cell"><a class="phone-number" href="tel:${digits}">${escapeHTML(phone)}</a><span class="phone-actions"><a href="tel:${digits}">Call</a>${whatsapp}</span></span>`;
  }

  function orderTimestamp(order) {
    return dateValue(order.createdAt)?.getTime() || 0;
  }

  function orderItems(order) {
    return Array.isArray(order.items) ? order.items : [];
  }

  function itemQuantity(item) {
    const quantity = Number(item.qty ?? item.quantity ?? 1);
    return Number.isFinite(quantity) ? Math.max(0, quantity) : 1;
  }

  function imageSource(image) {
    if (!image) return "";
    if (/^(data:|https?:\/\/|\/)/i.test(image)) return image;
    return `../${image}`;
  }

  function statusSlug(status) {
    return String(status || "Pending").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (user.email?.toLowerCase() !== "wear@gmail.com") {
      alert("You are not authorized to access THE WEAR Admin.");
      await signOut(auth);
      return;
    }
    $("#adminEmailValue").textContent = user.email || dash;
    $("#authStatusValue").textContent = "Signed in";
    await loadAllData();
  });

  async function loadAllData() {
    try {
      await Promise.all([loadProducts(), loadOrders(), loadCustomers()]);
      renderAll();
    } catch (error) {
      console.error(error);
      alert(`Firebase data load failed:\n\n${error.message}`);
    }
  }

  async function loadProducts() {
    const snapshot = await getDocs(collection(db, "products"));
    products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  }

  async function loadOrders() {
    const snapshot = await getDocs(collection(db, "orders"));
    orders = snapshot.docs.map(item => ({ firebaseId: item.id, ...item.data() }));
    orders.sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
  }

  async function loadCustomers() {
    try {
      const snapshot = await getDocs(collection(db, "customers"));
      customerRecords = snapshot.docs.map(item => ({ firebaseId: item.id, ...item.data() }));
    } catch (error) {
      console.warn("Customers collection unavailable:", error);
      customerRecords = [];
    }
  }

  function uniqueCustomers() {
    const customers = new Map();
    const aliases = new Map();
    const add = (source, order = null) => {
      const phone = String(source?.phone || "").trim();
      const email = String(source?.email || "").trim().toLowerCase();
      const nameCity = `record:${String(source?.name || "Customer").trim().toLowerCase()}|${String(source?.city || "").trim().toLowerCase()}`;
      const identity = phone ? `phone:${phone}` : email ? `email:${email}` : nameCity;
      const key = aliases.get(`phone:${phone}`) || aliases.get(`email:${email}`) || aliases.get(nameCity) || identity;
      const current = customers.get(key) || { name: "", phone: "", email: "", city: "", address: "", orders: 0, spending: 0, lastOrder: 0, orderHistory: [] };
      current.name ||= source.name || "";
      current.phone ||= phone;
      current.email ||= email;
      current.city ||= source.city || "";
      current.address ||= source.address || "";
      if (order) {
        current.orders += 1;
        current.spending += Number(order.total || 0);
        current.lastOrder = Math.max(current.lastOrder, orderTimestamp(order));
        current.orderHistory.push(order);
      }
      customers.set(key, current);
      if (phone) aliases.set(`phone:${phone}`, key);
      if (email) aliases.set(`email:${email}`, key);
      if (source?.name || source?.city) aliases.set(nameCity, key);
    };
    customerRecords.forEach(record => add(record));
    orders.forEach(order => {
      const customer = order.customer || {};
      add({
        ...customer,
        name: customer.name || order.customerName,
        phone: customer.phone || order.phone,
        email: customer.email || order.email,
        city: customer.city || order.city,
        address: customer.address || order.address
      }, order);
    });
    return [...customers.values()].sort((a, b) => b.lastOrder - a.lastOrder);
  }

  function renderStats() {
    $("#statProducts").textContent = products.length.toLocaleString("en-PK");
    $("#statOrders").textContent = orders.length.toLocaleString("en-PK");
    $("#statCustomers").textContent = uniqueCustomers().length.toLocaleString("en-PK");
    $("#statRevenue").textContent = money(orders.reduce((sum, order) => sum + Number(order.total || 0), 0));
    const orderCount = status => orders.filter(order => String(order.status || "Pending").toLowerCase() === status.toLowerCase()).length;
    $("#statPending").textContent = orderCount("Pending").toLocaleString("en-PK");
    $("#statConfirmed").textContent = orderCount("Confirmed").toLocaleString("en-PK");
    $("#statProcessing").textContent = orderCount("Processing").toLocaleString("en-PK");
    $("#statDelivered").textContent = orderCount("Delivered").toLocaleString("en-PK");
    $("#statLowStock").textContent = products.filter(product => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5).length.toLocaleString("en-PK");
    $("#statOutStock").textContent = products.filter(product => Number(product.stock || 0) <= 0).length.toLocaleString("en-PK");
  }

  function renderAll() {
    renderStats();
    renderProducts();
    renderOrders();
    renderCustomers();
    renderRecentOrders();
  }

  function renderRecentOrders() {
    const rows = $("#recentOrderRows");
    const recent = orders.slice(0, 8);
    if (!recent.length) {
      rows.innerHTML = `<tr><td colspan="7" class="empty-cell">No orders found.</td></tr>`;
      return;
    }
    rows.innerHTML = recent.map(order => {
      const customer = order.customer || {};
      const id = order.id || order.firebaseId;
      const status = order.status || "Pending";
      return `<tr><td class="order-id">${escapeHTML(id)}</td><td>${escapeHTML(customer.name || order.customerName || "Customer")}</td><td>${phoneLinks(customer.phone || order.phone)}</td><td>${escapeHTML(formatOrderDate(order.createdAt))}</td><td class="numeric-cell">${amountOrDash(order.total)}</td><td><span class="badge badge-status status-${statusSlug(status)}">${escapeHTML(status)}</span></td><td><button type="button" class="table-action" data-order="${escapeHTML(order.firebaseId)}">View</button></td></tr>`;
    }).join("");
  }

  function renderProducts() {
    const query = $("#productSearch").value.trim().toLowerCase();
    const stockFilter = $("#productStockFilter").value;
    const categoryFilter = $("#productCategoryFilter").value;
    $("#productTotalCount").textContent = products.length.toLocaleString("en-PK");
    $("#productLowStockCount").textContent = products.filter(product => Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5).length.toLocaleString("en-PK");
    $("#productOutStockCount").textContent = products.filter(product => Number(product.stock || 0) <= 0).length.toLocaleString("en-PK");
    const filtered = products.filter(product => {
      const stock = Number(product.stock || 0);
      const matchesQuery = `${product.name || ""} ${product.category || ""} ${product.badge || ""}`.toLowerCase().includes(query);
      const matchesStock = stockFilter === "All" || (stockFilter === "In Stock" && stock > 5) || (stockFilter === "Low Stock" && stock > 0 && stock <= 5) || (stockFilter === "Out of Stock" && stock <= 0);
      const matchesCategory = categoryFilter === "All" || String(product.category || "").toLowerCase() === categoryFilter.toLowerCase();
      return matchesQuery && matchesStock && matchesCategory;
    });
    const rows = $("#productRows");
    if (!filtered.length) {
      rows.innerHTML = `<tr><td colspan="9" class="empty-cell">No products found.</td></tr>`;
      return;
    }
    rows.innerHTML = filtered.map(product => {
      const stock = Number(product.stock || 0);
      const stockClass = stock <= 0 ? "stock-out" : stock <= 5 ? "stock-low" : "stock-good";
      const image = imageSource(product.image);
      return `<tr>
        <td><div class="product-cell">${image ? `<img class="product-thumb" src="${escapeHTML(image)}" alt="" loading="lazy">` : `<span class="product-thumb product-placeholder">—</span>`}<span class="product-name">${escapeHTML(product.name || "Unnamed product")}</span></div></td>
        <td>${escapeHTML(product.category || dash)}</td>
        <td class="numeric-cell">${money(product.price)}</td>
        <td class="numeric-cell">${Number(product.oldPrice || 0) ? money(product.oldPrice) : dash}</td>
        <td class="numeric-cell">${stock.toLocaleString("en-PK")}</td>
        <td><span class="badge stock-badge ${stockClass}">${stock <= 0 ? "Out of Stock" : stock <= 5 ? "Low Stock" : "In Stock"}</span></td>
        <td>${product.featured ? `<span class="badge badge-featured">Featured</span>` : `<span class="muted">No</span>`}</td>
        <td>${product.badge ? `<span class="badge badge-product">${escapeHTML(product.badge)}</span>` : dash}</td>
        <td><div class="row-actions"><button type="button" class="table-action" data-edit="${escapeHTML(product.id)}">Edit</button><button type="button" class="table-action action-danger" data-delete="${escapeHTML(product.id)}">Delete</button></div></td>
      </tr>`;
    }).join("");
  }

  function renderOrders() {
    const query = $("#orderSearch").value.trim().toLowerCase();
    const statusFilter = $("#orderStatusFilter").value;
    const filtered = orders.filter(order => {
      const customer = order.customer || {};
      const searchText = `${order.id || ""} ${order.firebaseId || ""} ${customer.name || order.customerName || ""} ${customer.phone || order.phone || ""} ${customer.city || order.city || ""}`.toLowerCase();
      return searchText.includes(query) && (statusFilter === "All" || String(order.status || "Pending").toLowerCase() === statusFilter.toLowerCase());
    });
    const rows = $("#orderRows");
    if (!filtered.length) {
      rows.innerHTML = `<tr><td colspan="9" class="empty-cell">No orders found.</td></tr>`;
      return;
    }
    rows.innerHTML = filtered.map(order => {
      const customer = order.customer || {};
      const id = order.id || order.firebaseId;
      const status = order.status || "Pending";
      return `<tr>
        <td class="order-id">${escapeHTML(id)}</td><td>${escapeHTML(formatOrderDate(order.createdAt))}</td>
        <td>${escapeHTML(customer.name || order.customerName || "Customer")}</td><td>${phoneLinks(customer.phone || order.phone)}</td>
        <td>${orderItems(order).reduce((sum, item) => sum + itemQuantity(item), 0)} items</td><td class="numeric-cell">${amountOrDash(order.total)}</td>
        <td>${escapeHTML(order.payment || order.paymentMethod || dash)}</td><td><span class="badge badge-status status-${statusSlug(status)}">${escapeHTML(status)}</span></td>
        <td><button type="button" class="table-action" data-order="${escapeHTML(order.firebaseId)}">View</button></td>
      </tr>`;
    }).join("");
  }

  function renderCustomers() {
    const query = $("#customerSearch").value.trim().toLowerCase();
    customerSummaries = uniqueCustomers();
    let customers = customerSummaries.filter(customer => `${customer.name} ${customer.phone} ${customer.city}`.toLowerCase().includes(query));
    const sort = $("#customerSort").value;
    if (sort === "orders") customers.sort((a, b) => b.orders - a.orders || b.lastOrder - a.lastOrder);
    else if (sort === "spending") customers.sort((a, b) => b.spending - a.spending || b.lastOrder - a.lastOrder);
    else customers.sort((a, b) => b.lastOrder - a.lastOrder);
    const rows = $("#customerRows");
    if (!customers.length) {
      rows.innerHTML = `<tr><td colspan="6" class="empty-cell">No customers found.</td></tr>`;
      return;
    }
    rows.innerHTML = customers.map(customer => {
      const index = customerSummaries.indexOf(customer);
      return `<tr>
      <td><button type="button" class="customer-name-button" data-customer-index="${index}">${escapeHTML(customer.name || "Customer")}</button></td><td>${phoneLinks(customer.phone)}</td><td>${escapeHTML(customer.city || dash)}</td>
      <td>${customer.orders.toLocaleString("en-PK")}</td><td class="numeric-cell">${money(customer.spending)}</td><td>${customer.lastOrder ? escapeHTML(formatDate(customer.lastOrder)) : dash}</td>
    </tr>`;
    }).join("");
  }

  function showCustomerDetails(customer) {
    if (!customer) return;
    activeCustomer = customer;
    $("#customerModalTitle").textContent = customer.name || "Customer details";
    const history = [...customer.orderHistory].sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
    const historyRows = history.length ? history.map(order => {
      const id = order.id || order.firebaseId;
      const status = order.status || "Pending";
      return `<tr><td class="order-id">${escapeHTML(id)}</td><td>${escapeHTML(formatOrderDate(order.createdAt))}</td><td class="numeric-cell">${amountOrDash(order.total)}</td><td><span class="badge badge-status status-${statusSlug(status)}">${escapeHTML(status)}</span></td><td><button type="button" class="table-action" data-customer-order="${escapeHTML(order.firebaseId)}">View order</button></td></tr>`;
    }).join("") : `<tr><td colspan="5" class="empty-cell">No order history found.</td></tr>`;
    $("#customerModalBody").innerHTML = `
      <div class="detail-grid">
        <section class="detail-card"><h3>Customer information</h3><dl><div><dt>Name</dt><dd>${escapeHTML(customer.name || dash)}</dd></div><div><dt>Phone</dt><dd>${phoneLinks(customer.phone)}</dd></div><div><dt>Email</dt><dd>${escapeHTML(customer.email || dash)}</dd></div><div><dt>City</dt><dd>${escapeHTML(customer.city || dash)}</dd></div><div><dt>Address</dt><dd>${escapeHTML(customer.address || dash)}</dd></div></dl></section>
        <section class="detail-card"><h3>Customer summary</h3><dl><div><dt>Total orders</dt><dd>${customer.orders.toLocaleString("en-PK")}</dd></div><div><dt>Total spending</dt><dd>${money(customer.spending)}</dd></div><div><dt>Last order</dt><dd>${customer.lastOrder ? escapeHTML(formatDate(customer.lastOrder)) : dash}</dd></div></dl></section>
      </div>
      <section class="detail-card customer-history"><h3>Order history <span>${history.length}</span></h3><div class="table-wrap"><table class="admin-table customer-history-table"><thead><tr><th>Order ID</th><th>Date</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${historyRows}</tbody></table></div></section>`;
    $("#customerModal").hidden = false;
    document.body.classList.add("modal-open");
    $("#closeCustomerModal").focus();
  }

  function closeCustomerModal() {
    $("#customerModal").hidden = true;
    document.body.classList.remove("modal-open");
    activeCustomer = null;
  }

  function openProduct(product = null) {
    const form = $("#productForm");
    form.reset();
    $("#pId").value = product?.id || "";
    $("#pName").value = product?.name || "";
    $("#pCategory").value = product?.category || "Caps";
    $("#pPrice").value = product?.price ?? "";
    $("#pOld").value = product?.oldPrice ?? "";
    $("#pStock").value = product?.stock ?? 10;
    $("#pBadge").value = product?.badge || "";
    $("#pDescription").value = product?.description || "";
    $("#pImage").value = product?.image && localProductImages.includes(product.image) ? product.image : "";
    $("#pImageCurrent").value = product?.image || "";
    $("[name=featured]").checked = product?.featured === true;
    $("#productFormTitle").textContent = product ? "Edit product" : "Add product";
    const preview = $("#imagePreview");
    if (product?.image) {
      $("#imagePreviewImg").src = imageSource(product.image);
      preview.hidden = false;
    } else preview.hidden = true;
    $("#product-form").hidden = false;
    $("#product-form").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#pName").focus({ preventScroll: true });
  }

  function closeProductForm() {
    $("#product-form").hidden = true;
    $("#productForm").reset();
    $("#pId").value = "";
    $("#pImage").value = "";
    $("#pImageCurrent").value = "";
    $("#imagePreview").hidden = true;
  }

  async function saveProduct(event) {
    event.preventDefault();
    const submit = $("#productForm button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Saving…";
    try {
      const data = new FormData($("#productForm"));
      const id = data.get("id");
      const existingImage = $("#pImageCurrent").value || "";
      const selectedImage = String($("#pImage").value || "").trim();
      const image = selectedImage || existingImage;
      if (selectedImage && !localProductImages.includes(selectedImage)) {
        throw new Error("Choose one of the available local product images.");
      }
      if (!image || (!id && !selectedImage)) {
        throw new Error("Choose one of the available local product images.");
      }
      const product = {
        name: data.get("name") || "", category: data.get("category") || "Caps",
        price: Number(data.get("price")) || 0, oldPrice: Number(data.get("oldPrice")) || 0,
        stock: Number(data.get("stock")) || 0, badge: data.get("badge") || "NEW", image,
        description: data.get("description") || "", featured: data.get("featured") === "on"
      };
      if (id) await updateDoc(doc(db, "products", id), product);
      else await addDoc(collection(db, "products"), product);
      await loadProducts();
      renderAll();
      closeProductForm();
    } catch (error) {
      console.error("Product save error:", error);
      alert(`Product save failed:\n\n${error.message}`);
    } finally {
      submit.disabled = false;
      submit.textContent = "Save product";
    }
  }

  async function updateOrderStatus(id, status) {
    try {
      await updateDoc(doc(db, "orders", id), { status });
      const order = orders.find(item => item.firebaseId === id);
      if (order) order.status = status;
      renderAll();
      if (activeOrder?.firebaseId === id) showOrderDetails(order);
    } catch (error) {
      console.error(error);
      alert(`Order status update failed:\n\n${error.message}`);
      await loadOrders();
      renderAll();
      if (activeOrder?.firebaseId === id) {
        showOrderDetails(orders.find(order => order.firebaseId === id));
      }
    }
  }

  function showOrderDetails(order) {
    if (!order) return;
    activeOrder = order;
    const customer = order.customer || {};
    const items = orderItems(order);
    const subtotal = order.subtotal;
    const shipping = order.shipping ?? order.delivery ?? order.deliveryFee ?? order.shippingFee;
    const orderId = order.id || order.firebaseId;
    const paymentMethod = order.payment || order.paymentMethod || dash;
    const paymentStatus = order.paymentStatus || dash;
    const deliveryAddress = customer.address || order.address;
    const addressText = deliveryAddress
      ? `${deliveryAddress}${customer.city || order.city ? `, ${customer.city || order.city}` : ""}`
      : customer.city || order.city || dash;
    $("#orderModalTitle").textContent = `Order #${orderId}`;
    const itemMarkup = items.length ? items.map(item => {
      const quantity = itemQuantity(item);
      const product = products.find(record => record.id === (item.id || item.productId));
      const name = item.name || product?.name || "Product";
      const image = item.image || item.productImage || item.imageUrl || product?.image;
      const unitPrice = amountOrDash(item.price);
      const priceIsAvailable = item.price !== null && item.price !== undefined && item.price !== "" && Number.isFinite(Number(item.price));
      const lineTotal = item.lineTotal ?? item.total ?? (priceIsAvailable ? Number(item.price) * quantity : null);
      const imageMarkup = image
        ? `<img class="order-product-image" src="${escapeHTML(imageSource(image))}" alt="${escapeHTML(name)}">`
        : `<span class="order-product-image order-product-placeholder" aria-hidden="true">—</span>`;
      return `<div class="order-item">${imageMarkup}<div class="order-product-description"><strong>${escapeHTML(name)}</strong>${item.category ? `<span>${escapeHTML(item.category)}</span>` : ""}<span>Qty: ${quantity}</span></div><div class="item-price"><span>${unitPrice} each</span><strong>${amountOrDash(lineTotal)}</strong></div></div>`;
    }).join("") : `<p class="empty-inline">No item details are available for this order.</p>`;
    $("#orderModalBody").innerHTML = `
      <div class="detail-grid">
        <section class="detail-card"><h3>Order information</h3><dl><div><dt>Order ID</dt><dd>${escapeHTML(orderId)}</dd></div><div><dt>Date and time</dt><dd>${escapeHTML(formatOrderDate(order.createdAt))}</dd></div><div><dt>Payment method</dt><dd>${escapeHTML(paymentMethod)}</dd></div><div><dt>Payment status</dt><dd>${escapeHTML(paymentStatus)}</dd></div><div><dt>Order status</dt><dd><span class="badge badge-status status-${statusSlug(order.status)}">${escapeHTML(order.status || "Pending")}</span></dd></div></dl></section>
        <section class="detail-card"><h3>Customer information</h3><dl><div><dt>Name</dt><dd>${escapeHTML(customer.name || order.customerName || dash)}</dd></div><div><dt>Phone</dt><dd>${phoneLinks(customer.phone || order.phone)}</dd></div><div><dt>Email</dt><dd>${escapeHTML(customer.email || order.email || dash)}</dd></div><div><dt>City</dt><dd>${escapeHTML(customer.city || order.city || dash)}</dd></div></dl></section>
      </div>
      <section class="detail-card address-card"><h3>Full address</h3><p>${escapeHTML(addressText)}</p></section>
      <section class="detail-card item-card"><h3>Products <span>${items.length}</span></h3><div class="order-items">${itemMarkup}</div><div class="order-totals"><div><span>Subtotal</span><strong>${amountOrDash(subtotal)}</strong></div><div><span>Shipping</span><strong>${amountOrDash(shipping)}</strong></div><div class="total-line"><span>Total</span><strong>${amountOrDash(order.total)}</strong></div></div></section>
      <div class="modal-actions"><span class="modal-actions-label">Update order status</span><div class="modal-status-actions"><button type="button" class="button button-secondary" data-modal-status="Confirmed">Confirm order</button><button type="button" class="button button-secondary" data-modal-status="Processing">Processing</button><button type="button" class="button button-secondary" data-modal-status="Shipped">Shipped</button><button type="button" class="button button-secondary" data-modal-status="Delivered">Delivered</button><button type="button" class="button button-cancel" data-modal-status="Cancelled">Cancel order</button></div></div>`;
    $("#orderModal").hidden = false;
    document.body.classList.add("modal-open");
    $("#closeOrderModal").focus();
  }

  function closeOrderModal() {
    $("#orderModal").hidden = true;
    document.body.classList.remove("modal-open");
    activeOrder = null;
  }

  function showPage(id) {
    const pageId = document.getElementById(id) ? id : "dashboard";
    document.querySelectorAll(".admin-page").forEach(page => page.classList.toggle("active", page.id === pageId));
    document.querySelectorAll(".admin-nav a[href^='#']").forEach(link => link.classList.toggle("active", link.hash === `#${pageId}`));
    document.title = `${pageId[0].toUpperCase()}${pageId.slice(1)} · THE WEAR Admin`;
  }

  document.querySelectorAll(".admin-nav a[href^='#']").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    const id = link.hash.slice(1);
    history.replaceState(null, "", `#${id}`);
    showPage(id);
  }));
  document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => {
    history.replaceState(null, "", `#${button.dataset.go}`);
    showPage(button.dataset.go);
  }));
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1)));
  showPage(location.hash.slice(1));

  $("#productSearch").addEventListener("input", renderProducts);
  $("#productStockFilter").addEventListener("change", renderProducts);
  $("#productCategoryFilter").addEventListener("change", renderProducts);
  $("#customerSearch").addEventListener("input", renderCustomers);
  $("#customerSort").addEventListener("change", renderCustomers);
  $("#orderSearch").addEventListener("input", renderOrders);
  $("#orderStatusFilter").addEventListener("change", renderOrders);
  $("#newProduct").addEventListener("click", () => openProduct());
  $("#productForm").addEventListener("submit", saveProduct);
  $("#cancelProduct").addEventListener("click", closeProductForm);
  $("#cancelProductTop").addEventListener("click", closeProductForm);
  $("#refreshData").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Refreshing…";
    await loadAllData();
    button.disabled = false;
    button.textContent = "Refresh data";
  });
  $("#pImage").addEventListener("change", event => {
    const image = event.target.value || $("#pImageCurrent").value;
    if (!image) {
      $("#imagePreview").hidden = true;
      return;
    }
    $("#imagePreviewImg").src = imageSource(image);
    $("#imagePreview").hidden = false;
  });
  $("#closeOrderModal").addEventListener("click", closeOrderModal);
  $("#orderModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeOrderModal(); });
  $("#closeCustomerModal").addEventListener("click", closeCustomerModal);
  $("#customerModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeCustomerModal(); });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!$("#orderModal").hidden) closeOrderModal();
    if (!$("#customerModal").hidden) closeCustomerModal();
  });

  document.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.edit) {
      const product = products.find(item => item.id === button.dataset.edit);
      if (product) openProduct(product);
    } else if (button.dataset.delete) {
      if (!confirm("Are you sure you want to delete this product?")) return;
      try {
        await deleteDoc(doc(db, "products", button.dataset.delete));
        await loadProducts();
        renderAll();
      } catch (error) { console.error(error); alert(`Delete failed:\n\n${error.message}`); }
    } else if (button.dataset.order) {
      showOrderDetails(orders.find(order => order.firebaseId === button.dataset.order));
    } else if (button.dataset.modalStatus && activeOrder) {
      updateOrderStatus(activeOrder.firebaseId, button.dataset.modalStatus);
    } else if (button.dataset.customerIndex !== undefined) {
      showCustomerDetails(customerSummaries[Number(button.dataset.customerIndex)]);
    } else if (button.dataset.customerOrder) {
      const order = orders.find(item => item.firebaseId === button.dataset.customerOrder);
      closeCustomerModal();
      showOrderDetails(order);
    }
  });
  $("#logout").addEventListener("click", async () => {
    try { await signOut(auth); window.location.href = "login.html"; }
    catch (error) { console.error(error); alert("Logout failed."); }
  });
})();
