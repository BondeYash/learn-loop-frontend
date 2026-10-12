import test from "node:test";
import assert from "node:assert/strict";
import axiosInstance from "../src/services/axiosInstance.js";
import { validCheckout, loadRazorpay, openRazorpay, createCheckout } from "../src/services/payments.js";
const record = () => ({ order: { id: "507f1f77bcf86cd799439033", provider: "razorpay", testMode: true, amountMinor: 12345 }, checkout: { provider: "razorpay", keyId: "rzp_test_synthetic", orderId: "order_synthetic", amount: 12345, currency: "INR", name: "Synthetic course" } });
globalThis.window = new EventTarget();
test("checkout validates mode, key, saved reference and exact INR amount", () => {
  const data=record();assert.ok(validCheckout(data,12345,true));
  for(const change of [{order:{...data.order,testMode:false}},{order:{...data.order,id:"foreign"}},{order:{...data.order,provider:"legacy"}},{checkout:{...data.checkout,keyId:"rzp_live_synthetic"}},{checkout:{...data.checkout,amount:999}},{checkout:{...data.checkout,currency:"USD"}},{checkout:{...data.checkout,orderId:"../evil"}}]) assert.equal(validCheckout({...data,...change},12345,true),false);
  assert.equal(validCheckout(data,12346,true),false);assert.equal(validCheckout(data,12345,undefined),false);
});
test("SDK loads only on request, shares pending loads and allows retry after failure", async () => {
  let script, appends=0;
  globalThis.document={createElement:()=>({remove(){}}),head:{appendChild(s){script=s;appends++;}}};
  const first=loadRazorpay(), second=loadRazorpay();assert.equal(first,second);assert.equal(appends,1);assert.equal(script.src,"https://checkout.razorpay.com/v1/checkout.js");
  script.onerror();await assert.rejects(first,/could not load/);
  const retry=loadRazorpay();assert.equal(appends,2);window.Razorpay=class {};script.onload();await retry;
});
function widget(onOpen) {
  let options, instance, events={}, closed=0;
  window.Razorpay=class {constructor(o){options=o;instance=this;}on(type,fn){events[type]=fn;}open(){onOpen?.(options,events);}close(){closed++;options.modal.ondismiss();}};
  return {get options(){return options;},get instance(){return instance;},get events(){return events;},get closed(){return closed;}};
}
test("widget success, dismissal, failed attempt and abort settle once", async () => {
  let w=widget();let promise=openRazorpay(record().checkout);assert.equal(w.options.order_id,"order_synthetic");assert.equal(w.options.retry.enabled,false);
  w.options.handler({razorpay_payment_id:"pay_synthetic"});w.options.modal.ondismiss();assert.equal((await promise).razorpay_payment_id,"pay_synthetic");
  w=widget();promise=openRazorpay(record().checkout);w.options.modal.ondismiss();await assert.rejects(promise,e=>e.code==="RAZORPAY_CANCELED");
  w=widget();promise=openRazorpay(record().checkout);w.events["payment.failed"]();await assert.rejects(promise,e=>e.code==="RAZORPAY_FAILED");assert.equal(w.closed,1);
  const controller=new AbortController();w=widget();promise=openRazorpay(record().checkout,controller.signal);controller.abort();w.options.handler({});await assert.rejects(promise,e=>e.name==="AbortError");assert.equal(w.closed,1);
  await assert.rejects(openRazorpay(record().checkout,controller.signal),e=>e.name==="AbortError");
});
test("checkout submits stable request key and verifies through the server", async () => {
  const original=axiosInstance.post,calls=[];
  widget(options=>queueMicrotask(()=>options.handler({razorpay_order_id:"order_synthetic",razorpay_payment_id:"pay_synthetic",razorpay_signature:"0".repeat(64)})));
  axiosInstance.post=async(path,body,config)=>{calls.push({path,body,config});return{data:{data:path==="/payments/checkout"?record():{order:{...record().order,status:"paid",canAccess:true}}}};};
  try {const result=await createCheckout("course",12345,"stable-request-key",true);assert.equal(result.order.canAccess,true);assert.equal(calls.length,2);assert.equal(calls[0].config.headers["Idempotency-Key"],"stable-request-key");assert.equal(calls[1].path,"/payments/orders/507f1f77bcf86cd799439033/verify");assert.equal(calls[1].body.razorpay_order_id,"order_synthetic");}finally{axiosInstance.post=original;}
});
test("lost verification response returns the saved attempt for recovery; forged verification is rejected", async () => {
  const original=axiosInstance.post;
  widget(o=>queueMicrotask(()=>o.handler({razorpay_order_id:"order_synthetic",razorpay_payment_id:"pay_synthetic",razorpay_signature:"0".repeat(64)})));
  axiosInstance.post=async(path)=>{if(path==="/payments/checkout")return{data:{data:record()}};throw new Error("Synthetic response lost");};
  try {const result=await createCheckout("course",12345,"stable-request-key",true);assert.equal(result.verificationPending,true);assert.equal(result.order.id,record().order.id);
    axiosInstance.post=async(path)=>{if(path==="/payments/checkout")return{data:{data:record()}};throw{response:{status:400}};};await assert.rejects(createCheckout("course",12345,"stable-request-key",true),e=>e.response.status===400);
  }finally{axiosInstance.post=original;}
});
test("failed widget refreshes its original record; cancelled widgets never verify", async () => {
  const original=axiosInstance.post,calls=[];axiosInstance.post=async(path)=>{calls.push(path);return{data:{data:record()}};};
  try {widget((o,e)=>queueMicrotask(()=>e["payment.failed"]()));await assert.rejects(createCheckout("course",12345,"stable-request-key",true),e=>e.code==="RAZORPAY_FAILED");assert.deepEqual(calls,["/payments/checkout","/payments/orders/507f1f77bcf86cd799439033/refresh"]);
    calls.length=0;widget(o=>queueMicrotask(()=>o.modal.ondismiss()));await assert.rejects(createCheckout("course",12345,"stable-request-key",true),e=>e.code==="RAZORPAY_CANCELED");assert.deepEqual(calls,["/payments/checkout"]);
  }finally{axiosInstance.post=original;}
});
test("invalid server response and page abort cannot open a widget", async () => {
  const original=axiosInstance.post;let opens=0;widget(()=>opens++);
  axiosInstance.post=async()=>({data:{data:{...record(),checkout:{...record().checkout,keyId:"rzp_live_synthetic"}}}});
  try {await assert.rejects(createCheckout("course",12345,"stable-request-key",true),/invalid checkout/);assert.equal(opens,0);
    const controller=new AbortController();controller.abort();await assert.rejects(createCheckout("course",12345,"stable-request-key",true,controller.signal),e=>e.name==="AbortError");assert.equal(opens,0);
  }finally{axiosInstance.post=original;}
});
