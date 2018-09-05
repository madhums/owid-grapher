import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany, ManyToOne, ManyToMany, JoinTable, Unique} from "typeorm"
import { Writable } from "stream"

import User from './User'
import { Source } from './Source'
import { Variable } from './Variable'
import Tag from './Tag'
import { csvRow, slugify, filenamify } from '../admin/serverUtil'
import * as db from '../db'

@Entity("datasets")
@Unique(["name", "namespace"])
export class Dataset extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() name!: string
    @Column({ default: "owid" }) namespace!: string
    @Column({ default: "" }) description!: string
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column({ default: false }) isPrivate!: boolean

    @OneToMany(type => Variable, variable => variable.dataset)
    variables!: Variable[]

    @OneToMany(type => Source, source => source.dataset)
    sources!: Source[]

    @ManyToOne(type => User, user => user.createdDatasets)
    createdByUser!: User

    @ManyToMany(type => Tag)
    @JoinTable()
    tags!: Tag[]

    // Export dataset variables to CSV (not including metadata)
    static async writeCSV(datasetId: number, stream: Writable) {
        const csvHeader = ["Entity", "Year"]
        const variables = await db.query(`SELECT name FROM variables v WHERE v.datasetId=? ORDER BY v.columnOrder ASC, v.id ASC`, [datasetId])
        for (const variable of variables) {
            csvHeader.push(variable.name)
        }

        stream.write(csvRow(csvHeader))

        const data = await db.query(`
            SELECT e.name AS entity, dv.year, dv.value FROM data_values dv
            JOIN variables v ON v.id=dv.variableId
            JOIN datasets d ON v.datasetId=d.id
            JOIN entities e ON dv.entityId=e.id
            WHERE d.id=?
            ORDER BY e.name ASC, dv.year ASC, dv.variableId ASC`, [datasetId])

        let row: string[] = []
        for (const datum of data) {
            if (datum.entity !== row[0] || datum.year !== row[1]) {
                // New row
                if (row.length) {
                    stream.write(csvRow(row))
                }
                row = [datum.entity, datum.year]
            }

            row.push(datum.value)
        }

        // Final row
        stream.write(csvRow(row))

        stream.end()
    }

    async toCSV(): Promise<string> {
        let csv = ""
        await Dataset.writeCSV(this.id, { write: (s: string) => csv += s, end: () => null } as any)
        return csv
    }

    get filename() {
        return filenamify(this.name)
    }

    get slug() {
        return slugify(this.name)
    }

    // Return object representing datapackage.json for this dataset
    async toDatapackage(): Promise<any> {
        // XXX
        const sources = await Source.find({ datasetId: this.id })
        const variables = await Variable.find({ datasetId: this.id })

        const initialFields = [
            { name: "Entity", type: "string" },
            { name: "Year", type: "year" }
        ]

        const dataPackage = {
            name: this.name,
            title: this.name,
            id: this.id,
            description: this.description,
            sources: sources.map(s => s.toDatapackage()),
            resources: [{
                path: `${this.name}.csv`,
                schema: {
                    fields: initialFields.concat(variables.map(v => ({
                        name: v.name,
                        type: "any",
                        description: v.description,
                        owidDisplaySettings: v.display
                    })))
                }
            }]
        }

        return dataPackage
    }
}