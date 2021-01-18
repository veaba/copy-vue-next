export const enum TextModes {
  //                | ELEMENT | 实体  | 结束标志        |  内部             |
  DATA,    //   |   √     |   √  | 祖先的结束标签   |                  |
  RCDATA,  //   |   ×     |   √  | parent 结束标签 | <textarea>       |
  RAWTEXT, //   |   ×     |   ×  | parent 结束标签 | <style>,<script> |
  CDATA,
  ATTRIBUTE_VALUE
}
