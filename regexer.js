export class RegExer {
    /** @param {RegExp} regex */
    static toPatternString( regex ) {
        return /^\/(.*?)\/[a-z]*$/.exec( "" + regex )[1]
    }

    constructor() {
        /** @type {{name:string|undefined,pattern:RegExp}[]} */
        this.groups = []
    }

    /** @param {string|RegExp|RegExer} name @param {RegExp|RegExer|undefined} pattern */
    group( name, pattern ) {
        if ( name instanceof RegExer || name instanceof RegExp )
            pattern = name, name = undefined
        if ( pattern instanceof RegExer )
            pattern = pattern.build()
        this.groups.push( { name, pattern } )
        return this
    }

    /** @param {string|undefined} flags */
    build( flags ) {
        const groups = []
        for ( const group of this.groups ) {
            groups.push( `(${group.name ? `?<${group.name}>` : ""}${RegExer.toPatternString( group.pattern )})` )
        }
        return RegExp( groups.join( "|" ), flags )
    }
}
