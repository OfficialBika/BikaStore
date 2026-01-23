
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
    <p>Fast top-up for Mobile Legends, PUBG UC, CoC & more</p>
    
  </header>
  <main class="container">
    <section id="products">
<html>
<head> 
<h2>Products</h2>
      <ul class="product-list">
        <li class="product" data-id="mld_100">


<html>
<head>
  <title>Game Items List</title>
  <style>
    body {
      font-family: Arial;
      background: #f4f4f4;
      padding: 30px;
      text-align: center;
    }

    .box {
      background: white;
      padding: 30px;
      border-radius: 8px;
      max-width: 800px;
      margin: auto;
    }

    img {
      width: 100%;
      border-radius: 8px;
    }

    .btn {
      display: inline-block;
      margin-top: 15px;
      background: #0d6efd;
      color: white;
      padding: 12px 20px;
      text-decoration: none;
      border-radius: 5px;
    }
  </style>
  
</head>
<body>

<div class="box">
  <img src="mlbb.jpg" alt="Mlbb Diamonds Prices">
  <h2>Game Top-Up</h2>
  <p>Price: 10,000 MMK</p>
  <p>Fast Reply • Secure payment</p>

  <a href="https://t.me/Official_Bika" class="btn">Order Now</a>
  <br><br>
  <a href="pubg.html">⬅ Pubg Uc Prices</a>
</div>

</body>
</html>
    
          <h3>Mobile Legends - 86 Diamonds</h3>
          <p>Price: 4800mmk</p>
          <button onclick="buy('mld_100')">Buy</button>
        </li>

        <li class="product" data-id="pubg_uc_60">
          <h3>PUBG UC - 60 UC</h3>
          <p>Price: 4500mmk</p>
          <button onclick="buy('pubg_uc_60')">Buy</button>
        </li>

        <li class="product" data-id="coc_gems_50">
          <h3>Clash of Clans - 50 Gems</h3>
          <p>Price: $1.49</p>
          <button onclick="buy('coc_gems_50')">Buy</button>
        </li>
      </ul>
    </section>

    <section id="how">
      <h2>How it works</h2>
      <ol>
        <li>Choose a product</li>
        <li>Enter in-game ID  (in checkout)</li>
        <li>Pay with secure gateway</li>
        <li>We deliver the top-up (manual or automatic)</li>
      </ol>
    </section>
  </main>

  <footer class="site-footer">
    <p>© <span id="year"></span> Bika Store</p>
  </footer>

<script>
document.getElementById('year').textContent = new Date().getFullYear();

async function buy(productId){
  const username = prompt("Enter your in-game ID / phone number:");
  if(!username) return alert("In-game ID required");

  const resp = await fetch('/.netlify/functions/purchase', { // adjust path for platform
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ productId, username })
  });

  const data = await resp.json();
  if(data.error) return alert("Error: " + data.error);
  // redirect to payment page
  window.location = data.checkoutUrl || '#';
}
</script>
</body>
</html>
