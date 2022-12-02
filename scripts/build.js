const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const rollup = require('rollup')
const terser = require('terser')

if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

// Mochi: 获取所有配置
let builds = require('./config').getAllBuilds()

// filter builds via command line arg
// 如果命令行有参数传入, 过滤配置
if (process.argv[2]) {
  const filters = process.argv[2].split(',')
  builds = builds.filter(b => {
    return filters.some(f => b.output.file.indexOf(f) > -1 || b._name.indexOf(f) > -1)
  })
} else {
  // Mochi: 没有传入参数就过滤掉打包 weex
  // filter out weex builds by default
  builds = builds.filter(b => {
    return b.output.file.indexOf('weex') === -1
  })
}

build(builds)

// Mochi: 拿到打包配置遍历, 一个一个交给 rollup 打包
function build (builds) {
  let built = 0
  const total = builds.length
  const next = () => {
    buildEntry(builds[built]).then(() => {
      built++
      if (built < total) {
        next()
      }
    }).catch(logError)
  }

  next()
}

// Mochi: 实际 rollup 打包函数, 拿到每项配置
function buildEntry (config) {
  const output = config.output
  const { file, banner } = output // Mochi: file 对应着 dest 打包 output
  const isProd = /(min|prod)\.js$/.test(file) // Mochi: 如果 output 文件的尾缀包含 min / prod, 还会使用 terser 进行压缩代码
  return rollup.rollup(config)
    .then(bundle => bundle.generate(output))
    .then(({ output: [{ code }] }) => {
      if (isProd) { // Mochi: 需要注意的是, 2.5 版本都是使用 uglify 进行压缩, 后面都换成了 terser
        const minified = (banner ? banner + '\n' : '') + terser.minify(code, {
          toplevel: true,
          output: {
            ascii_only: true
          },
          compress: {
            pure_funcs: ['makeMap']
          }
        }).code
        return write(file, minified, true)
      } else {
        return write(file, code)
      }
    })
}

function write (dest, code, zip) {
  return new Promise((resolve, reject) => {
    function report (extra) {
      console.log(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''))
      resolve()
    }

    fs.writeFile(dest, code, err => {
      if (err) return reject(err)
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err)
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        report()
      }
    })
  })
}

function getSize (code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

function logError (e) {
  console.log(e)
}

function blue (str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}

/* Mochi:
这里还有一点要注意, Vue 官网你可能会看见 runtime 版本和完整版(runtime + compiler)
显而易见, runtimeonly 的效率比 runtime + complier 的效率高, 且高得多

为什么要区分这俩玩意呢？首先得知道 Vue 的 template 可以是
1. 类似 HTML 的字符串模板 `<div></div>`
2. render 函数

compiler 实际上就是将字符串形式的 template 转化为 render 函数的工具, 因为浏览器是不认识字符串模板的, 人家只认识函数。

在使用打包工具构建我们的代码时, 我们是使用的 runtime 版本, 因为诸如 webpack 这样的构建工具会使用 vue-loader, 
将字符串 template 转化为 render 函数。

但是, 在不使用构建工具时, 比如使用 CDN 引入 Vue, 
如果需要使用字符串形式的 template, 就需要 compiler 对它进行解析, 生成 render 函数丢给浏览器执行。
当然如果使用 render 函数的 template, 用 runtime 版本就可以了。
*/
