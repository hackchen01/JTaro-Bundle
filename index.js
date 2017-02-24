var fs = require('fs-extra')
var path = require('path')
var rollup = require('rollup')
var jtaroModule = require('rollup-plugin-jtaro-module')

/**
 * 扫描目标index.html，从相对源index.html提取需要的文件
 * @param options.origin String 开发版的index
 * @param options.target String 生产版的index
 * @param options.copies Array<String> 不能从目标index扫描到的文件从这里拷贝，元素可为目录或文件，都必须相对源index
 */
exports.bundle = function (options) {
  // 扫描目标index
  var assets = scanTarget(options.target)
  var originDir = path.dirname(options.origin)
  var targetDir = path.dirname(options.target)

  // 拷贝需要直接拷贝的文件，合并不存在的文件（将文件夹里所有html/js用rollup打包成一个与文件夹同名的js文件）
  copyFiles(assets.concat(options.copies), originDir, targetDir, options.rollupPlugins || [])
}

function copyFiles (copies, ori, tar, plugins) {
  copies.forEach(f => {
    const oriFile = path.resolve(ori, f)
    const tarFile = path.resolve(tar, f)
    fs.stat(oriFile, (err, s) => {
      if (err) {
        fs.stat(path.dirname(oriFile), (err, s) => {
          if (s.isDirectory()) {
            rollupBundle({
              root: ori,
              src: oriFile.replace(/\.\w+/, '/'),
              dest: tarFile,
              plugins: plugins
            })
          }
          if (err) throw err
        })
      } else if (s.isFile() || s.isDirectory()) {
        fs.copy(oriFile, path.resolve(tar, f), err => {
          if (err) throw err
        })
      }
    })
  })
}

function scanTarget (file) {
  var text = fs.readFileSync(path.resolve(file)).toString()
  var paths = []
  text.replace(/(?:(?:href|src)=(?:"|'))([^"']+)(?:"|')/g, (match, p) => {
    paths.push(p)
  })
  return paths
}

function rollupBundle (options) {
  // 遍历demos/jroll_demo/pages里的js文件路径创建bundle.js
  var paths = fs.readdirSync(path.resolve(options.src))
  var content = ''
  var tempFile = path.resolve(options.root || '', '_jtaro_bundle_temp_' + path.basename(options.dest))

  paths.forEach((item, index) => {
    if (/\.js$/.test(item)) {
      content += 'import p' + index + ' from \'./pages/' + item + '\'\nVue.component(\'pages__' + item.replace('.js', '') + '\', p' + index + ')\n'
    }
  })
  // 创建临时文件
  fs.writeFileSync(tempFile, content)

  rollup.rollup({
    entry: tempFile,
    context: 'window',
    plugins: [jtaroModule({
      root: options.root || ''
    })].concat(options.plugins)
  }).then(function (bundle) {
    bundle.write({
      format: 'iife',
      dest: path.resolve(options.dest)
    })
    // 删除临时文件
    fs.unlinkSync(tempFile)
  })
}

