import { db } from "../firebase/firebase-config.js";

import { collection, addDoc, getDocs, doc, runTransaction } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


(function () {

  /* =========================================
     BASIC HELPERS
  ========================================= */

  let products = [];

  const migratedProductImages = {
    BzhcMdcVSsWQASmCTRf1: "assets/products/cap-02.png",
    EB95kmML9igUI58gxYlp: "assets/products/cap-01.png",
    G5r6fGh2SFtQqGgGkrt3: "assets/products/cap-03.png",
    w2yy1HCcbVNN92CGbPXi: "assets/products/cap-04.png"
  };

  const keyCart = "thewear_cart_v1";
  const keyOrders = "thewear_orders_v1";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const money = value =>
    "Rs. " +
    Number(value || 0).toLocaleString("en-PK");


  function getStock(product) {

    const stock =
      Number(product?.stock ?? 0);

    return Number.isFinite(stock) && stock > 0
      ? stock
      : 0;

  }


  /* =========================================
     FIREBASE PRODUCTS
  ========================================= */

  async function loadProductsFromFirebase() {
    const snapshot = await getDocs(collection(db, "products"));
    products = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));
    return products;
  }


  /* =========================================
     CART STORAGE
  ========================================= */

  function getCart() {

    try {

      return JSON.parse(
        localStorage.getItem(keyCart) || "[]"
      );

    } catch {

      return [];

    }

  }

  function productImage(product) {
    const localImage = migratedProductImages[product?.id];
    const image = product?.image || localImage || "";
    if (!image) return "";
    try {
      return new URL(image, location.origin + "/").href;
    } catch {
      return image;
    }
  }


  function setProductSeo(product) {
    if (!product || typeof product !== "object" || !product.id) return;
    const baseUrl = "https://thewear.iqbalsweets.com.pk/product.html";
    const isGeneratedPage = document.body.dataset.productId === String(product.id);
    const productUrl = isGeneratedPage
      ? "https://thewear.iqbalsweets.com.pk/products/" + encodeURIComponent(product.id) + "/"
      : baseUrl + "?id=" + encodeURIComponent(product.id);
    const imagePath = productImage(product);
    let imageUrl = "";
    try { imageUrl = imagePath ? new URL(imagePath, document.baseURI).href : ""; } catch { imageUrl = ""; }
    const name = typeof product.name === "string" && product.name.trim() ? product.name.trim() : "THE WEAR product";
    const description = typeof product.description === "string" ? product.description.trim() : "";
    const price = Number(product.price);
    const stock = Number(product.stock ?? 0);
    document.title = `${name} | THE WEAR`;
    const safeDescription = description || "Shop quality fashion products from THE WEAR in Pakistan.";
    const descriptionMeta = $("#product-meta-description");
    if (descriptionMeta) descriptionMeta.content = safeDescription;
    const setMeta = (selector, value) => { const element = $(selector); if (element) element.content = value; };
    setMeta("#product-og-title", document.title);
    setMeta("#product-og-description", safeDescription);
    setMeta("#product-og-url", productUrl);
    if (imageUrl) setMeta("#product-og-image", imageUrl);
    const canonical = $("#product-canonical");
    if (canonical) canonical.href = productUrl;
    const jsonLd = {
      "@context": "https://schema.org", "@type": "Product",
      "@id": `${productUrl}#product`, productID: String(product.id), name, url: productUrl,
      offers: { "@type": "Offer", url: productUrl, priceCurrency: "PKR",
        availability: Number.isFinite(stock) && stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" }
    };
    if (description) jsonLd.description = description;
    if (Number.isFinite(price) && price >= 0) jsonLd.offers.price = price;
    if (imageUrl) jsonLd.image = [imageUrl];
    let script = $("#product-jsonld");
    if (!script) { script = document.createElement("script"); script.id = "product-jsonld"; script.type = "application/ld+json"; document.head.appendChild(script); }
    script.textContent = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  }
  function saveCart(cart) {

    localStorage.setItem(
      keyCart,
      JSON.stringify(cart)
    );

    updateCount();

  }


  function getOrders() {

    try {

      return JSON.parse(
        localStorage.getItem(keyOrders) || "[]"
      );

    } catch {

      return [];

    }

  }


  /* =========================================
     TOAST
  ========================================= */

  function toast(message) {

    let element =
      $(".toast");

    if (!element) {

      element =
        document.createElement("div");

      element.className =
        "toast";

      document.body.appendChild(
        element
      );

    }

    element.textContent =
      message;

    element.classList.add(
      "show"
    );

    setTimeout(
      () =>
        element.classList.remove(
          "show"
        ),
      2200
    );

  }


  /* =========================================
     CART COUNT
  ========================================= */

  function updateCount() {

    const count =
      getCart().reduce(
        (total, item) =>
          total +
          Number(item.qty || 0),
        0
      );

    $$(".cart-count").forEach(
      element => {

        element.textContent =
          count;

      }
    );

  }


  /* =========================================
     ADD TO CART
     IMPORTANT:
     This always uses the real quantity.
  ========================================= */

  function add(id, quantity = 1) {

    const product =
      products.find(
        item =>
          item.id === id
      );

    if (!product)
      return false;


    const stock =
      getStock(product);


    if (stock <= 0) {

      toast(
        "Out of Stock"
      );

      return false;

    }


    quantity =
      Math.max(
        1,
        Number(quantity) || 1
      );


    const cart =
      getCart();


    const existing =
      cart.find(
        item =>
          item.id === id
      );


    const currentQuantity =
      existing
        ? Number(existing.qty || 0)
        : 0;


    if (
      currentQuantity +
      quantity >
      stock
    ) {

      toast(
        `Only ${stock} available`
      );

      return false;

    }


    if (existing) {

      existing.qty =
        currentQuantity +
        quantity;

    } else {

      cart.push({

        id: id,

        qty: quantity

      });

    }


    saveCart(cart);

    toast(
      `${quantity} added to cart`
    );

    return true;

  }


  /* =========================================
     PRODUCT CARD
  ========================================= */

  function productCard(product) {

    const stock =
      getStock(product);


    return `

      <article class="card">

        <a
          href="/products/${encodeURIComponent(product.id)}/"
          class="card-media"
        >

          <img
            src="${productImage(product)}"
            alt="${product.name || ""}"
            loading="lazy"
          >

          <span
            class="tag ${
              Number(product.oldPrice || 0) >
              Number(product.price || 0)
                ? "sale"
                : ""
            }"
          >
            ${product.badge || ""}
          </span>

        </a>


        <div class="card-body">

          <div class="card-cat">
            ${product.category || ""}
          </div>


          <h3>
            ${product.name || ""}
          </h3>


          <div class="price">

            ${money(product.price)}

            ${
              product.oldPrice
                ? `
                  <span class="old">
                    ${money(product.oldPrice)}
                  </span>
                `
                : ""
            }

          </div>


          <div class="stock-status">

            ${
              stock > 0
                ? `${stock} available`
                : "Out of Stock"
            }

          </div>


          <div class="card-actions">

            <button
              class="add"
              data-add="${product.id}"
              ${stock <= 0 ? "disabled" : ""}
            >

              ${
                stock > 0
                  ? "Add to Cart"
                  : "Out of Stock"
              }

            </button>


            <a
              class="view"
              href="/products/${encodeURIComponent(product.id)}/"
            >
              ↗
            </a>

          </div>

        </div>

      </article>

    `;

  }


  /* =========================================
     RENDER PRODUCT LIST
  ========================================= */

  function renderProducts(
    list,
    target
  ) {

    if (!target)
      return;


    target.innerHTML =
      list
        .map(productCard)
        .join("");

    target.setAttribute("aria-busy", "false");

    setupAdds();

  }


  /* =========================================
     ADD BUTTONS
  ========================================= */

  function setupAdds() {

    $$(".add").forEach(
      button => {

        button.onclick =
          event => {

            event.preventDefault();

            add(
              button.dataset.add,
              1
            );

          };

      }
    );

  }


  /* =========================================
     HOME PAGE
  ========================================= */

  function renderHome() {

    const featured =
      products.filter(
        product =>
          product.featured === true
      );


    renderProducts(
      featured,
      $("#featured-products")
    );


    renderProducts(
      products.slice(0, 4),
      $("#home-products")
    );

  }


  /* =========================================
     SHOP PAGE
  ========================================= */

  function renderShop() {

    const target =
      $("#shop-products");


    if (!target)
      return;


    const search =
      $("#shop-search");

    const category =
      $("#shop-category");

    const sort =
      $("#shop-sort");


    const params =
      new URLSearchParams(
        location.search
      );


    const urlSearch =
      params.get("search");

    const urlCategory =
      params.get("cat");


    if (
      urlSearch &&
      search
    ) {

      search.value =
        urlSearch;

    }


    if (
      urlCategory &&
      category
    ) {

      category.value =
        urlCategory;

    }


    function applyFilters() {

      let list =
        [...products];


      const query =
        (
          search?.value ||
          ""
        )
          .trim()
          .toLowerCase();


      if (query) {

        list =
          list.filter(
            product => {

              const text =
                [
                  product.name,
                  product.category,
                  product.description
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();

              return text.includes(
                query
              );

            }
          );

      }


      if (
        category &&
        category.value &&
        category.value !== "all"
      ) {

        list =
          list.filter(
            product =>
              product.category ===
              category.value
          );

      }


      if (
        sort?.value === "low"
      ) {

        list.sort(
          (a, b) =>
            Number(a.price || 0) -
            Number(b.price || 0)
        );

      }


      if (
        sort?.value === "high"
      ) {

        list.sort(
          (a, b) =>
            Number(b.price || 0) -
            Number(a.price || 0)
        );

      }


      if (
        sort?.value === "new"
      ) {

        list.reverse();

      }


      renderProducts(
        list,
        target
      );


      const resultCount =
        $("#result-count");


      if (resultCount) {

        resultCount.textContent =
          `${list.length} products`;

      }

    }


    [search, category, sort]
      .forEach(
        element => {

          if (!element)
            return;


          element.addEventListener(
            "input",
            applyFilters
          );


          element.addEventListener(
            "change",
            applyFilters
          );

        }
      );


    applyFilters();

  }


  /* =========================================
     PRODUCT DETAIL PAGE
  ========================================= */

  function renderProduct() {

    const id = new URLSearchParams(location.search).get("id") || document.body.dataset.productId;


    const product = products.find(item => item.id === id) || products[0];
    if (!product) return;


    const image =
      $("#product-image");

    const category =
      $("#product-category");

    const name =
      $("#product-name");

    const description =
      $("#product-description");

    const price =
      $("#product-price");

    const oldPrice =
      $("#product-old");

    const stockElement =
      $("#product-stock");

    const quantityElement =
      $("#product-qty");

    const plusButton =
      $("#qty-plus");

    const minusButton =
      $("#qty-minus");

    const addButton =
      $("#product-add");

    const buyButton =
      $("#product-buy");

    /* PRODUCT INFORMATION */

    if (image) {

      image.src = productImage(product);

      image.alt =
        product.name || "";

    }


    if (category)
      category.textContent =
        product.category || "";


    if (name)
      name.textContent =
        product.name || "";


    if (description)
      description.textContent =
        product.description || "";


    if (price)
      price.textContent =
        money(product.price);


    if (oldPrice) {

      oldPrice.textContent =
        product.oldPrice
          ? money(product.oldPrice)
          : "";

    }


    const stock =
      getStock(product);


    if (stockElement) {

      stockElement.textContent =
        stock > 0
          ? `${stock} available`
          : "Out of Stock";

    }


    setProductSeo(product);


    /* =========================================
       ONE REAL QUANTITY VARIABLE
       Everything uses this variable.
    ========================================= */

    let quantity = 1;


    function setQuantity(value) {

      let newQuantity =
        Number(value);


      if (
        !Number.isFinite(
          newQuantity
        )
      ) {

        newQuantity = 1;

      }


      newQuantity =
        Math.floor(
          newQuantity
        );


      if (newQuantity < 1)
        newQuantity = 1;


      if (
        stock > 0 &&
        newQuantity > stock
      ) {

        newQuantity =
          stock;

      }


      if (stock <= 0)
        newQuantity = 0;


      quantity =
        newQuantity;


      if (!quantityElement)
        return;


      /*
        Works with both:
        <input>
        and
        <span>/<div>
      */

      if (
        "value" in
        quantityElement
      ) {

        quantityElement.value =
          String(quantity);

      } else {

        quantityElement.textContent =
          String(quantity);

      }

    }


    function getDisplayedQuantity() {

      if (!quantityElement)
        return quantity;


      let value;


      if (
        "value" in
        quantityElement
      ) {

        value =
          Number(
            quantityElement.value
          );

      } else {

        value =
          Number(
            quantityElement.textContent
          );

      }


      if (
        !Number.isFinite(value)
      ) {

        return quantity;

      }


      return value;

    }


    setQuantity(
      stock > 0 ? 1 : 0
    );


    /* =========================================
       PLUS
    ========================================= */

    if (plusButton) {

      plusButton.type =
        "button";


      plusButton.onclick =
        event => {

          event.preventDefault();
          event.stopPropagation();


          const current =
            getDisplayedQuantity();


          if (current < stock) {

            setQuantity(
              current + 1
            );

          } else {

            toast(
              `Only ${stock} available`
            );

          }

        };

    }


    /* =========================================
       MINUS
    ========================================= */

    if (minusButton) {

      minusButton.type =
        "button";


      minusButton.onclick =
        event => {

          event.preventDefault();
          event.stopPropagation();


          const current =
            getDisplayedQuantity();


          if (current > 1) {

            setQuantity(
              current - 1
            );

          } else {

            setQuantity(1);

          }

        };

    }


    /* =========================================
       MANUAL QUANTITY INPUT
    ========================================= */

    if (
      quantityElement &&
      "value" in quantityElement
    ) {

      quantityElement.min =
        "1";

      quantityElement.max =
        String(stock);


      quantityElement.addEventListener(
        "input",
        () => {

          let value =
            Number(
              quantityElement.value
            );


          if (
            !Number.isFinite(value)
          ) {

            value = 1;

          }


          if (value < 1)
            value = 1;


          if (
            stock > 0 &&
            value > stock
          ) {

            value = stock;

            toast(
              `Only ${stock} available`
            );

          }


          setQuantity(
            value
          );

        }
      );

    }


    /* =========================================
       ADD TO CART
    ========================================= */

    if (addButton) {

      addButton.type =
        "button";


      if (stock <= 0) {

        addButton.disabled =
          true;

        addButton.textContent =
          "Out of Stock";

      } else {

        addButton.disabled =
          false;

        addButton.textContent =
          "ADD TO CART";

      }


      addButton.onclick =
        event => {

          event.preventDefault();
          event.stopPropagation();


          if (stock <= 0) {

            toast(
              "Out of Stock"
            );

            return;

          }


          const selectedQuantity =
            getDisplayedQuantity();


          add(
            product.id,
            selectedQuantity
          );

        };

    }


    /* =========================================
       BUY NOW
    ========================================= */

    if (buyButton) {

      buyButton.type =
        "button";


      if (stock <= 0) {

        buyButton.disabled =
          true;

        buyButton.textContent =
          "Out of Stock";

      } else {

        buyButton.disabled =
          false;

      }


      buyButton.onclick =
        event => {

          event.preventDefault();
          event.stopPropagation();


          if (stock <= 0) {

            toast(
              "Out of Stock"
            );

            return;

          }


          const selectedQuantity =
            getDisplayedQuantity();


          const added =
            add(
              product.id,
              selectedQuantity
            );


          if (added) {

            location.href =
              "cart.html";

          }

        };

    }

  }


  /* =========================================
     CART ITEMS
  ========================================= */

  function cartItems() {

    return getCart()
      .map(item => {

        const product =
          products.find(
            p =>
              p.id === item.id
          );


        if (!product)
          return null;


        return {

          ...product,

          qty:
            Number(
              item.qty || 0
            )

        };

      })
      .filter(Boolean);

  }


  /* =========================================
     CART PAGE
  ========================================= */

  function renderCart() {

    const list =
      cartItems();


    const box =
      $("#cart-items");

    const empty =
      $("#cart-empty");

    const area =
      $("#cart-area");


    if (!box)
      return;


    if (!list.length) {

      if (area)
        area.style.display =
          "none";


      if (empty)
        empty.style.display =
          "block";


      return;

    }


    if (empty)
      empty.style.display =
        "none";


    if (area)
      area.style.display =
        "grid";


    box.innerHTML =
      list
        .map(product => `

          <div class="cart-item">

            <img
              src="${productImage(product)}"
              alt="${product.name || ""}"
              loading="lazy"
            >


            <div>

              <h3>
                ${product.name || ""}
              </h3>


              <p>
                ${money(product.price)}
                · Qty ${product.qty}
              </p>


              <button
                class="remove"
                type="button"
                data-remove="${product.id}"
              >
                Remove
              </button>

            </div>


            <strong>

              ${money(
                Number(product.price || 0) *
                Number(product.qty || 0)
              )}

            </strong>

          </div>

        `)
        .join("");


    $$(".remove").forEach(
      button => {

        button.onclick =
          event => {

            event.preventDefault();


            const id =
              button.dataset.remove;


            const updated =
              getCart().filter(
                item =>
                  item.id !== id
              );


            saveCart(
              updated
            );


            renderCart();

          };

      }
    );


    const subtotal =
      list.reduce(
        (total, product) =>
          total +
          Number(product.price || 0) *
          Number(product.qty || 0),
        0
      );


    const shipping =
      subtotal >= 4000
        ? 0
        : 200;


    const subtotalElement =
      $("#subtotal");


    if (subtotalElement)
      subtotalElement.textContent =
        money(subtotal);


    const shippingElement =
      $("#shipping");


    if (shippingElement)
      shippingElement.textContent =
        shipping
          ? "Rs. 200"
          : "FREE";


    const totalElement =
      $("#total");


    if (totalElement)
      totalElement.textContent =
        money(
          subtotal +
          shipping
        );


    const checkoutButton =
      $("#checkout-btn");


    if (checkoutButton) {

      checkoutButton.type =
        "button";


      checkoutButton.onclick =
        () => {

          location.href =
            "checkout.html";

        };

    }

  }


  /* =========================================
     CHECKOUT
  ========================================= */

  function checkout() {

    const list =
      cartItems();


    if (!list.length) {

      location.href =
        "cart.html";

      return;

    }


    const subtotal =
      list.reduce(
        (total, product) =>
          total +
          Number(product.price || 0) *
          Number(product.qty || 0),
        0
      );


    const shipping =
      subtotal >= 4000
        ? 0
        : 200;


    const summary =
      $("#checkout-summary");


    if (summary) {

      summary.innerHTML =

        list
          .map(product => `

            <div class="sumrow">

              <span>

                ${product.name}
                ×
                ${product.qty}

              </span>


              <b>

                ${money(
                  Number(product.price || 0) *
                  Number(product.qty || 0)
                )}

              </b>

            </div>

          `)
          .join("")

        +

        `

          <div class="sumrow">

            <span>
              Shipping
            </span>

            <b>
              ${
                shipping
                  ? "Rs. 200"
                  : "FREE"
              }
            </b>

          </div>


          <div class="sumrow total">

            <span>
              Total
            </span>

            <b>

              ${money(
                subtotal +
                shipping
              )}

            </b>

          </div>

        `;

    }


    const form =
      $("#checkout-form");


    if (!form)
      return;


    form.onsubmit =
      async event => {

        event.preventDefault();


        const submitButton =
          form.querySelector(
            'button[type="submit"]'
          );


        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            "Placing Order...";

        }


        try {

          const formData =
            new FormData(form);


          const customer = {

            name:
              formData.get("name") ||
              "",

            phone:
              formData.get("phone") ||
              "",

            email:
              formData.get("email") ||
              "",

            address:
              formData.get("address") ||
              "",

            city:
              formData.get("city") ||
              ""

          };


          /*
            IMPORTANT:
            Create the order ID once.
          */

          const orderId =
            "TW-" +
            Date.now()
              .toString()
              .slice(-8);


          /*
            Keep the exact quantities
            selected by the customer.
          */

          const orderItems =
            list.map(
              product => ({

                id:
                  product.id,

                name:
                  product.name,

                price:
                  Number(
                    product.price || 0
                  ),

                qty:
                  Number(
                    product.qty || 0
                  ),

                image:
                  productImage(product)

              })
            );


          /*
            Fresh cart check before
            starting the transaction.
          */

          const cartNow =
            getCart();


          if (!cartNow.length) {

            throw new Error(
              "Your cart is empty."
            );

          }


          /*
            One Firestore transaction:
            1. Read current stock
            2. Verify every quantity
            3. Reduce stock
            4. Create order
          */

          const orderReference =
            doc(
              collection(
                db,
                "orders"
              )
            );


          await runTransaction(
            db,
            async transaction => {

              const productReferences =
                orderItems.map(
                  item =>
                    doc(
                      db,
                      "products",
                      item.id
                    )
                );


              const snapshots = [];


              /*
                Read ALL product documents
                before updating anything.
              */

              for (
                const reference
                of productReferences
              ) {

                const snapshot =
                  await transaction.get(
                    reference
                  );


                snapshots.push(
                  snapshot
                );

              }


              /*
                VERIFY STOCK
              */

              for (
                let i = 0;
                i < snapshots.length;
                i++
              ) {

                const snapshot =
                  snapshots[i];


                if (
                  !snapshot.exists()
                ) {

                  throw new Error(
                    "A product in your cart is no longer available."
                  );

                }


                const currentStock =
                  Number(
                    snapshot.data().stock ?? 0
                  );


                const requestedQuantity =
                  Number(
                    orderItems[i].qty || 0
                  );


                if (
                  requestedQuantity <= 0
                ) {

                  throw new Error(
                    "Invalid product quantity."
                  );

                }


                if (
                  currentStock <
                  requestedQuantity
                ) {

                  throw new Error(

                    `${
                      snapshot.data().name ||
                      "This product"
                    } has only ${
                      currentStock
                    } available.`

                  );

                }

              }


              /*
                REDUCE STOCK
              */

              for (
                let i = 0;
                i < snapshots.length;
                i++
              ) {

                const snapshot =
                  snapshots[i];


                const currentStock =
                  Number(
                    snapshot.data().stock ?? 0
                  );


                const requestedQuantity =
                  Number(
                    orderItems[i].qty || 0
                  );


                transaction.update(
                  productReferences[i],
                  {

                    stock:
                      currentStock -
                      requestedQuantity

                  }
                );

              }


              /*
                CREATE ORDER
              */

              const order = {

                id:
                  orderId,

                createdAt:
                  new Date()
                    .toISOString(),

                status:
                  "Pending",

                payment:
                  "Cash on Delivery",

                customer:
                  customer,

                items:
                  orderItems,

                subtotal:
                  subtotal,

                shipping:
                  shipping,

                total:
                  subtotal +
                  shipping

              };


              transaction.set(
                orderReference,
                order
              );

            }
          );


          /*
            SAVE CUSTOMER
          */

          try {

            await addDoc(
              collection(
                db,
                "customers"
              ),
              {

                name:
                  customer.name,

                phone:
                  customer.phone,

                email:
                  customer.email,

                address:
                  customer.address,

                city:
                  customer.city,

                createdAt:
                  new Date()
                    .toISOString(),

                lastOrderId:
                  orderId

              }
            );

          } catch (customerError) {

            console.warn(
              "Customer save failed:",
              customerError
            );

          }


          /*
            SAVE LOCAL ORDER
          */

          const localOrders =
            getOrders();


          localOrders.push({

            id:
              orderId,

            createdAt:
              new Date()
                .toISOString(),

            status:
              "Pending",

            payment:
              "Cash on Delivery",

            customer:
              customer,

            items:
              orderItems,

            subtotal:
              subtotal,

            shipping:
              shipping,

            total:
              subtotal +
              shipping

          });


          localStorage.setItem(
            keyOrders,
            JSON.stringify(
              localOrders
            )
          );


          /*
            SAVE LAST ORDER
          */

          localStorage.setItem(
            "thewear_last_order",
            JSON.stringify({

              id:
                orderId,

              createdAt:
                new Date()
                  .toISOString(),

              status:
                "Pending",

              payment:
                "Cash on Delivery",

              customer:
                customer,

              items:
                orderItems,

              subtotal:
                subtotal,

              shipping:
                shipping,

              total:
                subtotal +
                shipping

            })
          );


          /*
            CLEAR CART ONLY AFTER
            SUCCESSFUL TRANSACTION
          */

          localStorage.removeItem(
            keyCart
          );


          /*
            GO TO SUCCESS PAGE
          */

          location.href =
            "success.html";


        } catch (error) {

          console.error(
            "THE WEAR order error:",
            error
          );


          alert(
            "Order could not be placed.\n\n" +
            error.message
          );


          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              "Place Order";

          }

        }

      };

  }


  /* =========================================
     SUCCESS PAGE
  ========================================= */

  function success() {

    const order =
      JSON.parse(
        localStorage.getItem(
          "thewear_last_order"
        ) || "null"
      );


    if (!order)
      return;


    const orderElement =
      $("#success-order");


    if (orderElement)
      orderElement.textContent =
        order.id;


    const totalElement =
      $("#success-total");


    if (totalElement)
      totalElement.textContent =
        money(order.total);


    const nameElement =
      $("#success-name");


    if (nameElement)
      nameElement.textContent =
        order.customer?.name ||
        "";

  }


  /* =========================================
     GLOBAL THE WEAR OBJECT
  ========================================= */

  window.TW = {

    money,

    add,

    getCart,

    saveCart,

    cartItems,

    getOrders,

    get products() {

      return products;

    }

  };


  function renderCurrentPage(page) {
    updateCount();
    if (page === "home") renderHome();
    else if (page === "shop") renderShop();
    else if (page === "product") renderProduct();
    else if (page === "cart") renderCart();
    else if (page === "checkout") checkout();
    else if (page === "success") success();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
    const page = document.body.dataset.page;
    if (page === "success") { success(); return; }
    if (["home", "shop", "product", "cart", "checkout"].includes(page)) {
      try { await loadProductsFromFirebase(); renderCurrentPage(page); }
      catch (error) { console.error("Firebase products error:", error); }
    }
  });


})();
