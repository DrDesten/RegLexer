import { RegExer } from "./regexer.js"

class Token {
    /**
     * @param {string} name Token Name
     * @param {RegExp} pattern Token Pattern
     * @param {Object} properties
     * @param {boolean} properties.skip Skip Token
     * @param {{}} user_properties User-Defined Properties to Attach to Token
     */
    constructor( name, pattern, { skip = false } = {}, user_properties = {} ) {
        this.name = name
        this.pattern = pattern
        this.skip = skip
        this.user_properties = user_properties

        this.string = ""
    }
}

class RegLexer {
    static get JSONEncoder() {
        return {
            /** @param {string} string */
            encode( string ) {
                return string.split( "" )
                    .map( char => "_" + char.charCodeAt().toString( 32 ) )
                    .join( "" )
            },
            /** @param {string} string */
            decode( string ) {
                return string.split( "_" )
                    .map( substr => substr && String.fromCharCode( parseInt( substr, 32 ) ) )
                    .join( "" )
            },
        }
    }


    static get RegexBuilder() {
        return class {
            constructor() {
                this.builder = new RegExer
            }

            /** @param {Token} token The Token to add */
            addToken( token ) {
                const serialized = JSON.stringify( token )
                const encoded = RegLexer.JSONEncoder.encode( serialized )
                this.builder.group( encoded, token.pattern )
                return this
            }
            /** @param {Token[]} tokens The Tokens to add */
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
    }


    /** @param {RegExp} regex */
    constructor( regex ) {
        this.regex = RegExp( "^" + "(" + RegExer.toPatternString( regex ) + ")" )
    }

    /** @param {string} string */
    lex( string ) {

        const tokens = []
        while ( string ) {
            const match = this.regex.exec( string )
            if ( match === null || match[0].length === 0 ) {
                tokens.push( new Error( `Unexpected Character: '${string[0]}'` ) )
                string = string.substring( 1 )
                continue
            }

            const tokenMatch = Object.entries( match.groups ).find( ( [key, value] ) => value !== undefined )
            const token = JSON.parse( RegLexer.JSONEncoder.decode( tokenMatch[0] ) )
            token.string = tokenMatch[1]

            string = string.substring( token.string.length )
            if ( !token.skip ) tokens.push( token )
        }

        return tokens
    }
}

const regex = new RegLexer.RegexBuilder()
    .addTokens( [
        new Token( "Whitespace", /\s/, { skip: true } ),

        new Token( "Number", /\d+/ ),

        new Token( "LParen", /\(/ ),
        new Token( "RParen", /\)/ ),
        new Token( "Plus", /\+/ ),
        new Token( "Minus", /\-/ ),
        new Token( "Star", /\*/ ),
        new Token( "Slash", /\// ),
    ] )
    .build()

console.log( regex )

const lexer = new RegLexer( regex )
const tokens = lexer.lex( "1+1" )

console.log( tokens )