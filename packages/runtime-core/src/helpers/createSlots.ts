/**
 * compile runtime helper for creating dynamic slot object
 * @private
 * */
import { isArray } from '@vue/shared'
import { Slot } from '@vue/runtime-core'

interface CompiledSlotDescriptor {
  name: string
  fn: Slot
}

export function createSlots(
  slots: Record<string, Slot>,
  dynamicSlots: (
    | CompiledSlotDescriptor
    | CompiledSlotDescriptor[]
    | undefined
    )[]
): Record<string, Slot> {
  for (let i = 0; i < dynamicSlots.length; i++) {
    const slot = dynamicSlots[i]
    // 由 `<template v-for="..." #[...]>` 产生的动态 slot 数组
    if (isArray(slot)) {
      for (let j = 0; j < slot.length; j++) {
        slots[slot[j].name] = slot[j].fn
      }
    } else if (slot) {
      // 由 `<template v-for="..." #foo>` 产生的条件单 slot
      slots[slot.name] = slot.fn
    }
  }
  return slots
}
