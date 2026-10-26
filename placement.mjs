export function arrowMove(item,key,shift,width,height){
 const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[key];if(!direction)return false;
 const amount=shift?10:1;
 item.x=Math.max(0,Math.min(Math.max(0,width-item.w),item.x+direction[0]*amount));
 item.y=Math.max(0,Math.min(Math.max(0,height-item.h),item.y+direction[1]*amount));
 return true;
}
