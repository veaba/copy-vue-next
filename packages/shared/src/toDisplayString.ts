/**
 * 用于转换 {{}}
 * @private
 * */
import { isObject } from './index'


const replacer=(_key:string,val:any)=>{

}
export const toDisplayString = (val: unknown): string => {
  return val == null ? '' : isObject(val) ? JSON.stringify(val, replacer, 2) : String(val)
}
