/* ScatterPlot.jsx
 * ================
 *
 * Entry point for scatter charts
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import owid from '../owid'
import ChartConfig from './ChartConfig'
import NoData from './NoData'
import Axis from './Axis'
import AxisScale from './AxisScale'
import Layout from './Layout'
import Timeline from './Timeline'
import PointsWithLabels from './PointsWithLabels'
import {preInstantiate} from './Util'
import Paragraph from './Paragraph'
import ShapeLegend from './ShapeLegend'
import {Triangle} from './Marks'

type ScatterSeries = any

interface ColorLegendProps {
    x?: number,
    y?: number,
    maxWidth: number,
    colors: string[],
    scale: d3.ScaleOrdinal<string, string>,
    focusColor?: string,
    onMouseOver: (color: string) => void,
    onClick: (color: string) => void,
    onMouseLeave: () => void
}

@observer
class ColorLegend extends React.Component<ColorLegendProps, null> {
    static defaultProps: Partial<ShapeLegendProps> = {
        x: 0,
        y: 0,
        onMouseOver: () => null,
        onClick: () => null
        onMouseLeave: () => null
    }

    @computed get fontSize(): number { return 0.5 }
    @computed get rectSize(): number { return 5 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }

    @computed get labelMarks() {
        const {props, fontSize, rectSize, rectPadding} = this

        return _.filter(_.map(props.colors, color => {            
            const value = props.scale.domain()[props.scale.range().indexOf(color)]
            if (!value) return null

            const label = preInstantiate(<Paragraph maxWidth={props.maxWidth} fontSize={fontSize}>{value}</Paragraph>)
            return {
                label: label,
                color: color,
                width: rectSize+rectPadding+label.width,
                height: Math.max(label.height, rectSize)
            }
        }))
    }

    @computed get width() {
        return _.max(_.map(this.labelMarks, 'width'))
    }

    @computed get height() {
        return _.sum(_.map(this.labelMarks, 'height')) + this.lineHeight*this.labelMarks.length
    }

    render() {
        const {props, rectSize, rectPadding, lineHeight} = this
        let offset = 0

        return <g class="ColorLegend clickable" style={{cursor: 'pointer'}}>
            {_.map(this.labelMarks, mark => {
                const isFocus = mark.color == props.focusColor

                const result = <g class="legendMark" onMouseOver={e => this.props.onMouseOver(mark.color)} onMouseLeave={e => this.props.onMouseLeave()} onClick={e => this.props.onClick(mark.color)}>
                    <rect x={props.x} y={props.y+offset+rectSize/2} width={mark.width} height={mark.height} opacity={0}/>,
                    <rect x={props.x} y={props.y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color} stroke={isFocus && "#FFEC38"}/>,
                    <Paragraph {...mark.label.props} x={props.x+rectSize+rectPadding} y={props.y+offset}/>
                </g>

                offset += mark.height+lineHeight
                return result
            })}
        </g>
    }
}

interface ScatterWithAxisProps {
    bounds: Bounds,
    data: ScatterSeries[],
    xScale: AxisScale,
    yScale: AxisScale,
    xAxisLabel: string,
    yAxisLabel: string
}

@observer
class ScatterWithAxis extends React.Component<any, null> {
    render() {
        const {bounds, xScale, yScale, xAxisLabel, yAxisLabel, data} = this.props

        const xAxisBounds = Axis.calculateBounds(bounds, { orient: 'bottom', scale: xScale, label: xAxisLabel })
        const yAxisBounds = Axis.calculateBounds(bounds, { orient: 'left', scale: yScale, label: yAxisLabel })
        const innerBounds = bounds.padBottom(xAxisBounds.height).padLeft(yAxisBounds.width)

        return <g>
            <Axis orient="left" scale={yScale} labelText={yAxisLabel} bounds={bounds.padBottom(xAxisBounds.height)}/>
            <Axis orient="bottom" scale={xScale} labelText={xAxisLabel} bounds={bounds.padLeft(yAxisBounds.width)}/>
            <PointsWithLabels {...this.props} xScale={xScale} yScale={yScale} data={data} bounds={innerBounds}/>
        </g>
    }
}

@observer
export default class ScatterPlot extends React.Component<{ bounds: Bounds, config: ChartConfig, isStatic: boolean }, null> {
    @computed get chart() : ChartConfig {
        return this.props.config
    }

    @computed get bounds() : Bounds {
        return this.props.bounds
    }

    @computed get colorScheme() : string[] {
        return [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
            "#5675c1", // Africa
            "#aec7e8", // Antarctica
            "#d14e5b", // Asia
            "#ffd336", // Europe
            "#4d824b", // North America
            "#a652ba", // Oceania
            "#69c487", // South America
            "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]
    }

    @computed get dimensions() : Object[] {
        return this.chart.dimensions
    }

    @computed get colorScale() {
        const {colorScheme, dimensions} = this

        const colorScale = d3.scaleOrdinal().range(this.colorScheme)

        var colorDim = _.find(dimensions, { property: 'color' });
        if (colorDim) {
            colorScale.domain(colorDim.variable.categoricalValues);
        }

        return colorScale
    }

    @computed get timelineYears() {
        return this.yearsWithData
    }

    @computed get configTolerance() {
        return 1
    }

    // Precompute the data transformation for every timeline year (so later animation is fast)
    @computed get dataByEntityAndYear() {
        const {timelineYears, dimensions, configTolerance, colorScale} = this
        var dataByEntityAndYear = {};

        // The data values
        _.each(dimensions, function(dimension) {
            var variable = dimension.variable,
                tolerance = (dimension.property == 'color' || dimension.property == 'size') ? Infinity : configTolerance;

            var targetYears = timelineYears;

            _.each(timelineYears, function(targetYear) {
                for (var i = 0; i < variable.years.length; i++) {
                    var year = variable.years[i],
                        value = variable.values[i],
                        entity = variable.entityKey[variable.entities[i]];

                    // Skip years that aren't within tolerance of the target
                    if (year < targetYear-tolerance || year > targetYear+tolerance)
                        continue;

                    var dataByYear = owid.default(dataByEntityAndYear, entity.id, {}),
                        series = owid.default(dataByYear, targetYear, {
                            id: entity.id,
                            label: entity.name,
                            key: entity.name,
                            values: [{ time: {} }]
                        });

                    var d = series.values[0];

                    // Ensure we use the closest year to the target
                    var currentYear = d.time[dimension.property];
                    if (_.isFinite(currentYear) && Math.abs(currentYear-targetYear) < Math.abs(year-targetYear))
                        continue;

                    if (dimension.property == 'color')
                        series.color = colorScale(value);
                    else {
                        d.time[dimension.property] = year;
                        d[dimension.property] = value;
                    }
                }
            });
        });

        // Exclude any with data for only one axis
        _.each(dataByEntityAndYear, function(v, k) {
            var newDataByYear = {};
            _.each(v, function(series, year) {
                var datum = series.values[0];
                if (_.has(datum, 'x') && _.has(datum, 'y'))
                    newDataByYear[year] = series;
            });
            dataByEntityAndYear[k] = newDataByYear;
        });

        return dataByEntityAndYear;
    }

    @computed get currentData() : ScatterSeries[] {
        const {dataByEntityAndYear, startYear, endYear, isInterpolating} = this
        var currentData = [];

        _.each(dataByEntityAndYear, (dataByYear) => {
            /*if (!isInterpolating) {
                if (dataByYear[timeline.targetYear])
                    currentData.push(dataByYear[timeline.targetYear]);
                return;
            }*/

            let series = null
            _.each(dataByYear, (seriesForYear, year) => {
                if (year < startYear || year > endYear)
                    return

                series = series || _.extend({}, seriesForYear, { values: [] })
                series.values = series.values.concat(seriesForYear.values)
            })
            if (series && series.values.length)
                currentData.push(series)
        });

        return currentData;
    }


    @computed get axisDimensions() : Object[] {
        return _.filter(this.dimensions, function(d) { return d.property == 'x' || d.property == 'y'; });
    }

    @computed get yearsWithData() : number[] {
        const {axisDimensions} = this
        const tolerance = 0 // FIXME

        var yearSets = [];

        var minYear = _.min(_.map(axisDimensions, function(d) {
            return _.first(d.variable.years);
        }));

        var maxYear = _.max(_.map(axisDimensions, function(d) {
            return _.last(d.variable.years);
        }));

        _.each(axisDimensions, function(dimension) {
            var variable = dimension.variable,
                yearsForVariable = {};

            _.each(_.uniq(variable.years), function(year) {
                for (var i = Math.max(minYear, year-tolerance); i <= Math.min(maxYear, year+tolerance); i++) {
                    yearsForVariable[i] = true;
                }
            });

            yearSets.push(_.map(_.keys(yearsForVariable), function(year) { return parseInt(year); }));
        });

        return _.sortBy(_.intersection.apply(_, yearSets));
    }

    componentWillMount() {
        if (!_.isNumber(this.chart.timeRange[0]) || !_.isNumber(this.chart.timeRange[1]))
            this.chart.timeRange = [this.yearsWithData[0], _.last(this.yearsWithData)]
    }

    @action.bound onTargetChange({targetStartYear, targetEndYear}: {targetStartYear: number, targetEndYear: number}) {
        this.chart.timeRange = [targetStartYear, targetEndYear]
    }

    @computed get startYear() {
        return this.chart.timeRange[0]
    }

    @computed get endYear() {
        return this.chart.timeRange[1]
    }

    @computed get allSeries(): Object[] {
        const {dataByEntityAndYear} = this
        return _.flatten(
                  _.map(dataByEntityAndYear, dataByYear =>
                      _.values(dataByYear)
                  )
               )
        
    }

    @computed get allValues() : Object[] {
        const {dataByEntityAndYear} = this
        return _.flatten(_.map(this.allSeries, series => series.values))
    }

    // domains across the entire timeline
    @computed get xDomainDefault() : [number, number] {
        return d3.extent(_.map(this.allValues, 'x'))
    }

    @computed get xDomain() : [number, number] {
        return [
            _.defaultTo(this.chart.xDomain[0], this.xDomainDefault[0]),
            _.defaultTo(this.chart.xDomain[1], this.xDomainDefault[1])
        ]
    }

    @computed get yDomainDefault() : [number, number] {
        return d3.extent(_.map(this.allValues, 'y'))
    }

    @computed get yDomain() : [number, number] {
        return [
            _.defaultTo(this.chart.yDomain[0], this.yDomainDefault[0]),
            _.defaultTo(this.chart.yDomain[1], this.yDomainDefault[1])
        ]
    }

    @computed get colorsInUse(): string[] {
        return _.uniq(_.map(this.allSeries, 'color'))
    }

    @computed get xScale() : AxisScale {
        const {xDomain, chart} = this
        return new AxisScale({ scaleType: 'linear', domain: xDomain, tickFormat: chart.xTickFormat })
    }

    @computed get yScale() : AxisScale {
        const {yDomain, chart} = this
        return new AxisScale({ scaleType: 'linear', domain: yDomain, tickFormat: chart.yTickFormat })
    }

    @action.bound onSelectEntity(focusKeys) {
        this.chart.selectedEntities = focusKeys
    }

    @computed get timeline(): Timeline|null {
        if (this.props.isStatic) return null

        const {bounds, yearsWithData, startYear, endYear, onTargetChange} = this
        return preInstantiate(
            <Timeline bounds={bounds.fromBottom(35)} onTargetChange={onTargetChange} years={yearsWithData} startYear={startYear} endYear={endYear}/>
        )
    }

    @computed get timelineHeight(): number {
        return this.timeline ? this.timeline.height : 0
    }

    @computed get legend(): ColorLegend {
        return preInstantiate(<ColorLegend maxWidth={this.sidebarMaxWidth} colors={this.colorsInUse} scale={this.colorScale}/>)
    }

    @observable focusColor: string|null = null
    @action.bound onLegendMouseOver(color: string) {
        this.focusColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.focusColor = null
    }

    @action.bound onLegendClick() {
        if (_.isEqual(this.focusKeys, this.chart.selectedEntities))
            this.chart.selectedEntities = []
        else
            this.chart.selectedEntities = this.focusKeys
    }

    @computed get focusKeys(): string[] {
        if (this.focusColor) {
            return _.uniq(_.map(_.filter(this.allSeries, series => series.color == this.focusColor), series => series.key))
        } else {
            return this.chart.selectedEntities
        }
    }

    @computed get shapeLegend(): ShapeLegend {
        if (this.focusKeys.length || this.hoverSeries || this.chart.timeRange[0] == this.chart.timeRange[1])
            return null

        const shapeData=[
            {
                shape: <circle cx={3} cy={3} r={2} fill={"#333"} stroke="#ccc" strokeWidth={0.2} opacity={0.8}/>,
                text: this.chart.timeRange[0].toString()
            },
            { 
                shape: <Triangle cx={3} cy={3} r={3} fill={"#333"} stroke="#ccc" strokeWidth={0.2} opacity={1}/>,
                text: this.chart.timeRange[1].toString()
            }
        ]
        return preInstantiate(
            <ShapeLegend maxWidth={this.sidebarWidth} data={shapeData} shapeWidth={6}/>
        )
    }

    @observable.ref hoverSeries = null
    @action.bound onScatterMouseOver(series: ScatterSeries) {
        this.hoverSeries = series
    }

    @action.bound onScatterMouseLeave() {
        this.hoverSeries = null
    }

    @computed get tooltipSeries() {
        if (this.hoverSeries)
            return this.hoverSeries
        else if (this.focusKeys && this.focusKeys.length == 1)
            return _.find(this.currentData, series => series.key == this.focusKeys[0])
        else
            return null
    }

    @computed get sidebarMaxWidth() { return this.bounds.width*0.5 }
    @computed get sidebarMinWidth() { return 0 }
    @computed get sidebarWidth() {
        const {sidebarMinWidth, sidebarMaxWidth, legend} = this
        return Math.max(Math.min(legend.width, sidebarMaxWidth), sidebarMinWidth)
    }

    render() {
        const {currentData, bounds, yearsWithData, startYear, endYear, xScale, yScale, chart, timeline, timelineHeight, legend, focusKeys, focusColor, shapeLegend, hoverSeries, sidebarWidth, tooltipSeries} = this
        return <g>
            <ScatterWithAxis data={currentData} onMouseOver={this.onScatterMouseOver} bounds={this.bounds.padBottom(timelineHeight).padRight(sidebarWidth+20)} xScale={xScale} yScale={yScale} xAxisLabel={chart.xAxisLabel} yAxisLabel={chart.yAxisLabel} onSelectEntity={this.onSelectEntity} focusKeys={focusKeys} onMouseLeave={this.onScatterMouseLeave}/>
            <ColorLegend {...legend.props} x={bounds.right-sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColor={focusColor}/>
            {(shapeLegend || tooltipSeries) && <line x1={bounds.right-sidebarWidth} y1={bounds.top+legend.height+2} x2={bounds.right-5} y2={bounds.top+legend.height+2} stroke="#ccc"/>}
            {shapeLegend && <ShapeLegend {...shapeLegend.props} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11}/>}            
            {timeline && <Timeline {...timeline.props}/>}
            {tooltipSeries && <ScatterTooltip series={tooltipSeries} units={chart.units} maxWidth={sidebarWidth} x={bounds.right-sidebarWidth} y={bounds.top+legend.height+11+(shapeLegend ? shapeLegend.height : 0)}/>}}
        </g>
    }
}

interface ScatterTooltipProps {
    series: ScatterSeries
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps, undefined> {
    formatValue(value, property) {
        const {units} = this.props
        const unit = _.find(units, { property: property })
        let s = owid.unitFormat(unit, value[property])
        if (!unit || !unit.title)
            s = property + ": " + s
        return s
	}

    render() {
        const {x, y, maxWidth, series} = this.props
        const lineHeight = 5

        const firstValue = _.first(series.values)
        const lastValue = _.last(series.values)
        const values = series.values.length == 1 ? [firstValue] : [firstValue, lastValue]

        const elements = []
        const offset = 0

        const heading = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.6}>{series.label}</Paragraph>)
        elements.push(heading)
        offset += heading.height+lineHeight


        _.each(values, v => {
            const year = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.5}>{v.time.x.toString()}</Paragraph>)
            offset += year.height+lineHeight
            const line1 = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.4}>{this.formatValue(v, 'x')}</Paragraph>)
            offset += line1.height+lineHeight
            const line2 = preInstantiate(<Paragraph x={x} y={y+offset} maxWidth={maxWidth} fontSize={0.4}>{this.formatValue(v, 'y')}</Paragraph>)
            offset += line2.height+lineHeight            
            elements.push(...[year, line1, line2])
        })

        return <g class="scatterTooltip">
            {_.map(elements, el => el.render())}
        </g>
    }
}