// Injected only by isolated browser tests instead of the remote checkout SDK.
window.Razorpay = class {
  constructor(options) { this.options = options; this.events = {}; }
  on(type, callback) { this.events[type] = callback; }
  open() {
    this.element = document.createElement('section'); this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-label', 'Synthetic Razorpay checkout');
    this.element.style.cssText = 'position:fixed;inset:5%;z-index:9999;background:white;color:black;padding:20px;display:flex;flex-direction:column;gap:12px';
    for (const label of ['Pay successfully', 'Fail payment', 'Capture then close', 'Close checkout']) {
      const button = document.createElement('button'); button.textContent = label; this.element.appendChild(button);
      button.onclick = async () => {
        if (label === 'Close checkout') { this.close(); return; }
        button.disabled = true;
        const response = await fetch('/__fixture__/capture', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:this.options.order_id,status:label==='Fail payment'?'failed':'captured',webhook:label==='Capture then close'})});
        const data = await response.json(); this.element.remove();
        if (label === 'Fail payment') this.events['payment.failed']?.({});
        else if (label === 'Capture then close') this.options.modal.ondismiss();
        else this.options.handler(data);
      };
    }
    document.body.appendChild(this.element);
  }
  close() { this.element?.remove(); this.options.modal.ondismiss(); }
};
