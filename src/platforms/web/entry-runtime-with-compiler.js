/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element, // Mochi: tip: $mount 的 el 选项可以是 string 也可以是 HTMLElement
  hydrating?: boolean
): Component {
  // Mochi: tip: 不要就知道用三目表达式, 看看人家怎么用的😓
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    // Mochi: 建议不能将 el 指定为 body | document, 否则开发环境会产生警告
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  // Mochi: 如果有 render 函数, template 将被忽略
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        // Mochi: 如果 template 以 '#' 开头, 它将被用做 querySelector 的选择器, 并使用所选中元素的 innerHTML 作为模板字符串
        // Mochi: 这个一般是采用 CDN 的方式才会用到, 可以使用元素的 template 元素来书写模板
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        // Mochi: 划重点! 这就是 Vue2 的 template 只能有一个根元素的原因, 他会用 innerHTML
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // Michi: 如果既 render 也没有 template 选项, 则会采用 el 作为 template 
      template = getOuterHTML(el)
    }
    // Mochi: 如果含有 template, 则会将 template 转化为 render 函数, 所以这个是在挂载阶段完成的
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
