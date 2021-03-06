import { extend, some, isString, isNumber, uniq, sortedUniq, min, max, keyBy, keys, values, each, sortBy } from './Util'
import ChartConfig from './ChartConfig'
import { observable, computed, action, reaction } from 'mobx'

// XXX
import Admin from '../admin/Admin'
declare var window: { admin: Admin }

declare var Global: { rootUrl: string }
declare var App: { isEditor: boolean }

export class VariableDisplaySettings {
    @observable name?: string = undefined
    @observable unit?: string = undefined
    @observable shortUnit?: string = undefined
    @observable isProjection?: true = undefined
    @observable conversionFactor?: number = undefined
    @observable numDecimalPlaces?: number = undefined
    @observable tolerance?: number = undefined
}

export class Variable {
    @observable.ref id!: number
    @observable.ref name!: string
    @observable.ref description!: string
    @observable.ref unit!: string
    @observable.ref shortUnit!: string
    @observable.ref coverage!: string
    @observable.ref timespan!: string
    @observable.ref datasetName!: string
    @observable.ref datasetId!: string

    @observable display: VariableDisplaySettings = new VariableDisplaySettings()

    @observable.struct source!: {
        id: number,
        name: string,
        dataPublishedBy: string,
        dataPublisherSource: string,
        link: string,
        retrievedDate: string,
        additionalInfo: string,
    }
    @observable.ref years: number[] = []
    @observable.ref entities: string[] = []
    @observable.ref values: (string | number)[] = []

    constructor(json: any) {
        for (const key in this) {
            if (key in json) {
                if (key === "display") {
                    extend(this.display, json.display)
                } else {
                    this[key] = json[key]
                }
            }
        }
    }

    @computed get hasNumericValues(): boolean {
        return some(this.values, v => isFinite(v as number))
    }

    @computed get numericValues(): number[] {
        return sortBy(this.values.filter(v => isNumber(v))) as number[]
    }

    @computed get categoricalValues(): string[] {
        return uniq(this.values.filter(v => isString(v))) as string[]
    }

    @computed get hasCategoricalValues(): boolean {
        return some(this.values, v => isString(v))
    }

    @computed get entitiesUniq(): string[] {
        return uniq(this.entities)
    }

    @computed get yearsUniq(): number[] {
        return sortedUniq(this.years)
    }

    @computed get minYear(): number {
        return min(this.yearsUniq) as number
    }

    @computed get maxYear(): number {
        return max(this.yearsUniq) as number
    }

    @computed get minValue(): number {
        return min(this.numericValues) as number
    }

    @computed get maxValue(): number {
        return max(this.numericValues) as number
    }

    @computed get isNumeric(): boolean {
        return this.hasNumericValues && !this.hasCategoricalValues
    }
}

interface EntityMeta {
    id: number,
    name: string,
    code: string
}

export default class VariableData {
    chart: ChartConfig
    @observable.ref dataRequest?: Promise<Response>
    @observable.ref variablesById: { [id: number]: Variable } = {}
    @observable.ref entityMetaById: { [id: number]: EntityMeta } = {}

    constructor(chart: ChartConfig) {
        this.chart = chart
        reaction(() => this.variableIds, this.update)
        this.update()
    }

    @computed.struct get variableIds() {
        return uniq(this.chart.dimensions.map(d => d.variableId))
    }

    @computed get entityMetaByKey() {
        return keyBy(this.entityMetaById, 'name')
    }

    @computed get cacheTag(): string|undefined {
        return App.isEditor ? undefined : this.chart.cacheTag
    }

    @computed get availableEntities(): string[] {
        return keys(this.entityMetaByKey)
    }

    @computed get variables(): Variable[] {
        return values(this.variablesById)
    }

    @action.bound async update() {
        const { variableIds, chart, cacheTag } = this
        if (variableIds.length === 0 || this.chart.isNode) {
            // No data to download
            return
        }

        if (window.admin) {
            const json = await window.admin.getJSON(`/api/data/variables/${variableIds.join("+")}.json${cacheTag ? "?v="+cacheTag : ""}`)
            this.receiveData(json)
        } else {
            const req = new XMLHttpRequest()
            const that = this
            req.addEventListener("load", function() {
                that.receiveData(JSON.parse(this.responseText))
            })
            req.open("GET", `${Global.rootUrl}/data/variables/${variableIds.join("+")}.json?v=${cacheTag}`)
            req.send()
        }

    }

    @action.bound receiveData(json: any) {
        const variablesById: { [id: string]: Variable } = json.variables
        const entityMetaById: { [id: string]: EntityMeta } = json.entityKey
        for (const key in variablesById) {
            const variable = new Variable(variablesById[key])
            variable.entities = variable.entities.map(id => entityMetaById[id].name)
            variablesById[key] = variable
        }
        each(entityMetaById, (e, id) => e.id = +id)
        this.variablesById = variablesById
        this.entityMetaById = entityMetaById
    }
}
