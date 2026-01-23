<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Bika Store — Game Items</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="site-header">
    <h1>Bika Store</h1>
    <p>Top-up for Mobile Legends, PUBG UC, Clash of Clans — Pay via KBZ Pay or WavePay and confirm via chat.</p>
  </header>

  <main class="container">
    <section id="products">
      <h2>Products</h2>
      <ul class="product-list">
        <li class="product" data-id="mld_100" data-name="Mobile Legends - 86 Diamonds" data-price="1.99">
          <h3>Mobile Legends - 86 Diamonds</h3>
          <p>Price: $1.99</p>
          <button onclick="openCheckout(this)">Buy</button>
        </li>

        <li class="product" data-id="pubg_uc_60" data-name="PUBG UC - 60 UC" data-price="2.49">
          <h3>PUBG UC - 60 UC</h3>
          <p>Price: $2.49</p>
          <button onclick="openCheckout(this)">Buy</button>
        </li>

        <li class="product" data-id="coc_gems_50" data-name="Clash of Clans - 50 Gems" data-price="1.49">
          <h3>Clash of Clans - 50 Gems</h3>
          <p>Price: $1.49</p>
          <button onclick="openCheckout(this)">Buy</button>
        </li>
      </ul>
    </section>

    <section id="how">
      <h2>How it works</h2>
      <ol>
        <li>Choose a product</li>
        <li>Provide your in-game ID and phone number</li>
        <li>Pay with KBZ Pay or WavePay to our merchant number</li>
        <li>Send payment confirmation via WhatsApp (one-tap) to us</li>
        <li>We verify and deliver your top-up manually</li>
      </ol>
    </section>
  </main>

  <footer class="site-footer">
    <p>© <span id="year"></span> Bika Store</p>
  </footer>

  <!-- Checkout Modal -->
  <div id="checkoutModal" class="modal" aria-hidden="true">
    <div class="modal-content">
      <button class="close" onclick="closeModal()">×</button>
      <h2 id="modalTitle">Buy</h2>
      <form id="checkoutForm" onsubmit="submitOrder(event)">
        <input type="hidden" name="productId" id="productId" />
        <div class="field">
          <label>Product</label>
          <div id="productName"></div>
        </div>

        <div class="field">
          <label>Your in-game ID / IGN</label>
          <input type="text" id="username" name="username" required />
        </div>

        <div class="field">
          <label>Your phone (for delivery confirmation)</label>
          <input type="text" id="phone" name="phone" placeholder="+959..." required />
        </div>

        <div class="field">
          <label>Payment method</label>
          <select id="paymentMethod" name="paymentMethod" required>
            <option value="kbz">KBZ Pay</option>
            <option value="wave">WavePay</option>
          </select>
        </div>

        <div class="field">
          <button type="submit">Create Order & Get Payment Instructions</button>
        </div>
      </form>

      <div id="orderResult" style="display:none;">
        <h3>Payment Instructions</h3>
        <div id="paymentInstructions"></div>
        <p>After paying, click the button below to send confirmation via WhatsApp so we can verify and deliver.</p>
        <a id="waLink" class="wa-button" href="#" target="_blank">Send Payment Confirmation on WhatsApp</a>
      </div>
    </div>
  </div>

<script>
document.getElementById('year').textContent = new Date().getFullYear();

function openCheckout(btn){
  const li = btn.closest('.product');
  const id = li.dataset.id;
  const name = li.dataset.name;
  const price = li.dataset.price;

  document.getElementById('productId').value = id;
  document.getElementById('productName').textContent = `${name} — $${price}`;
  document.getElementById('modalTitle').textContent = `Buy: ${name}`;
  document.getElementById('orderResult').style.display = 'none';
  document.getElementById('checkoutForm').style.display = '';
  document.getElementById('checkoutModal').style.display = 'block';
  document.getElementById('checkoutModal').setAttribute('aria-hidden','false');
}

function closeModal(){
  document.getElementById('checkoutModal').style.display = 'none';
  document.getElementById('checkoutModal').setAttribute('aria-hidden','true');
}

async function submitOrder(e){
  e.preventDefault();
  const productId = document.getElementById('productId').value;
  const username = document.getElementById('username').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;

  if(!productId || !username || !phone) return alert('Please fill all fields');

  const resp = await fetch('/.netlify/functions/createOrder', { // adjust path for platform
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ productId, username, phone, paymentMethod })
  });

  const data = await resp.json();
  if(data.error) return alert('Error: ' + data.error);

  // show instructions and WA link
  document.getElementById('checkoutForm').style.display = 'none';
  document.getElementById('orderResult').style.display = '';
  document.getElementById('paymentInstructions').innerHTML = data.instructionsHtml;
  document.getElementById('waLink').href = data.waLink;
}
</script>
</body>
</html>
