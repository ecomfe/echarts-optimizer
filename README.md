## ECharts 构建工具

### 安装

```
$ [sudo] npm install -g echarts-optimizer
```

### 运行

默认情况下，将自动查找当前目录下的 `echarts/src` 和 `zrender/src` 作为 `echarts` 和 `zrender` 的源代码目录，并将构建结果生成在当前目录下的 `dist` 目录中。

```
$ echarts-optimize
```

添加 `--debug` 参数时，生成目录下会包含依赖分析结果。

```
$ echarts-optimize --debug
```

通过如下方式可以指定生成目录：

```
$ echarts-optimize echarts-dist
```

如果想要变更 `echarts` 和 `zrender` 的源代码目录，可以在当前目录下创建 `echarts-optimize-conf.js` 文件，指定 `amd` 配置项。配置文件是一个 node 模块，下面是一个配置文件的例子：

```javascript
exports.modules = {
    main: {name: 'echarts/echarts'},
    parts: [
        {name: 'echarts/chart/line', weight: 100},
        {name: 'echarts/chart/bar', weight: 100},
        {name: 'echarts/chart/scatter', weight: 90},
        {name: 'echarts/chart/k', weight: 30},
        {name: 'echarts/chart/pie', weight: 90},
        {name: 'echarts/chart/radar', weight: 30},
        {name: 'echarts/chart/chord', weight: 30},
        {name: 'echarts/chart/force', weight: 30},
        {
            name: 'echarts/chart/map',
            weight: 90,
            includeShallow: [
                'echarts/util/mapData/geoJson/an_hui_geo',
                'echarts/util/mapData/geoJson/ao_men_geo',
                'echarts/util/mapData/geoJson/bei_jing_geo',
                'echarts/util/mapData/geoJson/china_geo',
                'echarts/util/mapData/geoJson/chong_qing_geo',
                'echarts/util/mapData/geoJson/fu_jian_geo',
                'echarts/util/mapData/geoJson/gan_su_geo',
                'echarts/util/mapData/geoJson/guang_dong_geo',
                'echarts/util/mapData/geoJson/guang_xi_geo',
                'echarts/util/mapData/geoJson/gui_zhou_geo',
                'echarts/util/mapData/geoJson/hai_nan_geo',
                'echarts/util/mapData/geoJson/hei_long_jiang_geo',
                'echarts/util/mapData/geoJson/he_bei_geo',
                'echarts/util/mapData/geoJson/he_nan_geo',
                'echarts/util/mapData/geoJson/hu_bei_geo',
                'echarts/util/mapData/geoJson/hu_nan_geo',
                'echarts/util/mapData/geoJson/jiang_su_geo',
                'echarts/util/mapData/geoJson/jiang_xi_geo',
                'echarts/util/mapData/geoJson/ji_lin_geo',
                'echarts/util/mapData/geoJson/liao_ning_geo',
                'echarts/util/mapData/geoJson/nei_meng_gu_geo',
                'echarts/util/mapData/geoJson/ning_xia_geo',
                'echarts/util/mapData/geoJson/qing_hai_geo',
                'echarts/util/mapData/geoJson/shang_hai_geo',
                'echarts/util/mapData/geoJson/shan_dong_geo',
                'echarts/util/mapData/geoJson/shan_xi_1_geo',
                'echarts/util/mapData/geoJson/shan_xi_2_geo',
                'echarts/util/mapData/geoJson/si_chuan_geo',
                'echarts/util/mapData/geoJson/tai_wan_geo',
                'echarts/util/mapData/geoJson/tian_jin_geo',
                'echarts/util/mapData/geoJson/world_geo',
                'echarts/util/mapData/geoJson/xiang_gang_geo',
                'echarts/util/mapData/geoJson/xin_jiang_geo',
                'echarts/util/mapData/geoJson/xi_zang_geo',
                'echarts/util/mapData/geoJson/yun_nan_geo',
                'echarts/util/mapData/geoJson/zhe_jiang_geo'
            ]
        },
        {name: 'echarts/chart/gauge', weight: 30},
        {name: 'echarts/chart/funnel', weight: 30},
        {name: 'echarts/chart/eventRiver', weight: 10}
    ]
};

exports.amd = {
    baseUrl: process.cwd(),
    packages: [
        {
            name: 'echarts',
            location: '../echarts/src',
            main: 'echarts'
        },
        {
            name: 'zrender',
            location: '../zrender/src',
            main: 'zrender'
        }
    ]
};

```
