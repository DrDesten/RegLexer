import { RegExer } from "./regexer.js"

function isObjectLiteral( x ) {
    return Object.getPrototypeOf( x ) === Object.prototype
}

/**
 * @typedef {{[property: string]: any, ignore: boolean, merge: boolean}} TokenProperties
 */
/**
 * @template {string} T
 */
export class Token {
    /** @param {T} name @param {string} text */
    constructor( name, text ) {
        this.name = name
        this.text = text
        /** @type {TokenProperties} */
        this.props = {
            ignore: false,
            merge: false
        }
    }

    toString() {
        return this.text
    }
}

/**
 * @typedef {(token: Token, match: RegExpExecArray) => void} TokenMatchParser
 */
/**
 * @template {string} T
 */
export class TokenMatcher {
    /** @param {TokenProperties|TokenMatchParser} obj @returns {TokenMatchParser} */
    static createParserFunction( obj ) {
        if ( typeof obj === "function" ) return obj
        return token => Object.assign( token.props, obj )
    }

    /** @param {T} name @param {RegExp} regex @param {TokenProperties|TokenMatchParser} [parser] */
    constructor( name, regex, parser = () => {} ) {
        this.name = name
        this.regex = regex
        this.parser = TokenMatcher.createParserFunction( parser )
    }
}

class JSONEncoder {
    /** @param {string} string */
    static encode( string ) {
        return string.split( "" )
            .map( char => "_" + char.charCodeAt().toString( 32 ) )
            .join( "" )
    }
    /** @param {string} string */
    static decode( string ) {
        return string.split( "_" )
            .map( substr => substr && String.fromCharCode( parseInt( substr, 32 ) ) )
            .join( "" )
    }
}

class RegexBuilder {
    constructor() {
        this.builder = new RegExer
        this.parsers = []
    }

    /** @param {TokenMatcher} token The Token to add */
    addToken( token ) {
        const regex = token.regex
        const parser = this.parsers.push( token.parser ) - 1
        const serialized = JSON.stringify( { name: token.name, parser: parser } )
        const encoded = JSONEncoder.encode( serialized )
        this.builder.group( encoded, regex )
        return this
    }
    /** @param {TokenMatcher[]} tokens The Tokens to add */
    addTokens( tokens ) {
        for ( const token of tokens )
            this.addToken( token )
        return this
    }

    /** @param {string|undefined} flags */
    build( flags ) {
        return this.builder.build( flags )
    }
}

/**
 * @template {string} T
 */
export class RegLexer {
    /** @param {TokenMatcher<T>[]} tokens */
    constructor( tokens ) {
        this.builder = new RegexBuilder().addTokens( tokens )
        this.regex = RegExp( "^" + "(" + RegExer.toPatternString( this.builder.build() ) + ")" )
    }

    /** @param {string} string @returns {(Token<T>|Error)[]} */
    lex( string ) {

        const tokens = []
        while ( string ) {
            const match = this.regex.exec( string )
            if ( match === null || match[0].length === 0 ) {
                tokens.push( new Error( `Unexpected Character: '${string[0]}'` ) )
                string = string.substring( 1 )
                continue
            }

            const tokenMatch = Object.entries( match.groups ).find( ( [_, value] ) => value !== undefined )
            const tokenJSON = JSON.parse( JSONEncoder.decode( tokenMatch[0] ) )
            const token = new Token( tokenJSON.name, tokenMatch[1] )
            this.builder.parsers[tokenJSON.parser]( token, tokenMatch )

            string = string.substring( token.text.length )
            if ( !token.props.ignore ) tokens.push( token )
        }

        return tokens
    }
}