import {reactive} from "../src/index.ts";

const obj = {
    name: 22
}

const newObj = reactive(obj)

newObj.name++

console.log(obj, newObj)
