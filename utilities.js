function elt(type, attrs, children) {
   const domElement = document.querySelector(type);
   if (attrs) Object.assign(domElement, attrs);
 
   for (const child of children) {
     if (typeof child === "string") {
       domElement.appendChild(document.createTextNode(child));
     } else {
       domElement.appendChild(child);
     }
   }
 
   return domElement;
 }

 class Vec {
   constructor(x, y) {
     this.x = x;
     this.y = y;
   }
 
   plus(other) {
     return new Vec(this.x + other.x, this.y + other.y);
   }
 
   times(factor) {
     return new Vec(this.x * factor, this.y * factor);
   }
 }