import * as React from 'react'
import {observer} from 'mobx-react'
const timeago = require('timeago.js')()

import Admin from './Admin'
import Link from './Link'
import TagBadge, { Tag } from './TagBadge'

export interface DatasetListItem {
    id: number
    name: string
    namespace: string
    description: string
    createdAt: Date
    updatedAt: Date
    tags: Tag[]
}

@observer
class DatasetRow extends React.Component<{ dataset: DatasetListItem, searchHighlight?: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {dataset, searchHighlight} = this.props

        return <tr>
            <td>{dataset.namespace}</td>
            <td>
                <Link to={`/datasets/${dataset.id}`}>{searchHighlight ? searchHighlight(dataset.name) : dataset.name}</Link>
            </td>
            <td>{dataset.description}</td>
            <td>{dataset.tags.map(tag => <TagBadge tag={tag} searchHighlight={searchHighlight}/>)}</td>
            <td>{timeago.format(dataset.createdAt)}</td>
            <td>{timeago.format(dataset.updatedAt)}</td>
        </tr>
    }
}

@observer
export default class DatasetList extends React.Component<{ datasets: DatasetListItem[], searchHighlight?: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {props} = this
        return <table className="table table-bordered">
            <thead>
                <tr>
                    <th>Dataspace</th>
                    <th>Dataset</th>
                    <th>Description</th>
                    <th>Tags</th>
                    <th>Created</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                {props.datasets.map(dataset => <DatasetRow dataset={dataset} searchHighlight={props.searchHighlight}/>)}
            </tbody>
        </table>
    }
}