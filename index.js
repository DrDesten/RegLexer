// Position class
export class Position {
    /** 
     * @param {number} index The index of the position in the text
     * @param {number} line The line number of the position in the text
     * @param {number} column The column number of the position in the text
     */
    constructor( index, line, column ) {
        this.index = index
        this.line = line
        this.column = column
    }

    /** 
     * Advances the position by the given text.  
     * @param {string} text The text to advance by
     */
    advance( text ) {
        for ( const char of text ) {
            this.index++
            this.column++
            if ( char === '\n' ) {
                this.line++
                this.column = 1
            }
        }
        return this
    }

    clone() {
        return new Position( this.index, this.line, this.column )
    }

    get [Symbol.toStringTag]() { return "Position" }
}

// Range class
export class Range {
    /**
     * @param {Position} start The start position of the range.
     * @param {Position} end The end position of the range.
     */
    constructor( start, end ) {
        this.start = start
        this.end = end
    }

    /** Gets the length of the range. */
    get length() {
        return this.end.index - this.start.index
    }

    /** Clones the range. */
    clone() {
        return new Range( this.start.clone(), this.end.clone() )
    }

    get [Symbol.toStringTag]() { return "Range" }
}

// Token class
/**
 * @typedef {{[property: string]: any, ignore: boolean, hidden: boolean, merge: boolean, value?: boolean|number|string}} TokenProperties
 */
/** @template {string} T */
export class Token {
    /** 
     * Creates a map of token types to themselves.  
     * This is useful for creating a constant map of token types that can be used for TokenMatchers.
     * @template {string} T 
     * @param {T[]} types The token types
     * @returns {Readonly<{[K in T]: K}>} A map of token types to themselves
     */
    static Types( types ) {
        return Object.freeze( Object.fromEntries(
            types.map( t => [t, t] )
        ) )
    }

    /**
     * @param {T} type The type of the token 
     * @param {string} text The text of the token 
     * @param {Range} range The range of the token 
     */
    constructor( type, text, range ) {
        this.type = type
        this.text = text
        this.range = range
        /** @type {TokenProperties} */
        this.props = {
            ignore: false,
            merge: false
        }
    }

    /** Gets the start position of the token */
    get position() {
        return this.range.start
    }
    /** Returns the string representation of the token */
    toString() {
        return this.text
    }
    /** Returns the string representation of the token  */
    toPrimitive() {
        return this.props.value ?? this.text
    }

    get [Symbol.toStringTag]() { return "Token" }
}

// TokenMatcher class
/** @template {string} T */
export class TokenMatcher {
    /** 
     * @param {T} type The type of the token
     * @param {RegExp} regex The regular expression to match the token
     * @param {TokenProperties|(token: Token<T>, match: RegExpExecArray) => void} parser The parser to use to parse the token
     * @param {{[property:string]:any}} [props] The properties of the token
     */
    constructor( type, regex, parser, props = {} ) {
        this.type = type
        this.regex = regex
        this.parser = parser
        this.props = props
    }
}

// Lexer class
/** @template {string} T **/
export class Lexer {
    /** @returns {typeof Token<T>} */
    get Token() { return Token }
    /** @returns {typeof Parser<T>} */
    get Parser() { return Parser }

    /** 
     * Compiles the given matchers into a single regular expression.  
     * The compiled regular expression will match any of the given matchers.
     * @template {string} T 
     * @param {TokenMatcher<T>[]} matchers The matchers to compile. 
     * @returns {RegExp} The compiled regular expression. 
     */
    static compileMatchers( matchers ) {
        let compiled = matchers.map( ( { regex }, i ) => `(?<__${i}>${regex.source})` ).join( "|" )
        return new RegExp( compiled, "y" )
    }

    /** 
     * @param {TokenMatcher<T>[]} matchers The matchers to use to tokenize the input text.
     * @param {T} errorToken The type of the error token. 
     * @param {T} eofToken The type of the EOF token. 
     * @param {{ postprocess?: boolean }} [options] The options for the lexer.
     */
    constructor( matchers, errorToken, eofToken, { postprocess = true } = {} ) {
        this.matchers = matchers
        this.regex = Lexer.compileMatchers( matchers )
        this.errorToken = errorToken
        this.eofToken = eofToken
        this.props = { postprocess }
    }

    /** 
     * Tokenizes the next token in the input text.  
     * Returns null if there are no more tokens to be tokenized.
     * @param {string} text The input text to be tokenized
     * @param {Position} position The current position in the input text
     * @returns {Token<T>|null} The next token in the input text, or null if there are no more tokens to be tokenized
     */
    next( text, position ) {
        let index = position.index
        this.regex.lastIndex = index

        const result = this.regex.exec( text )
        if ( !result ) return null

        const matcherIndex = +Object.keys( result.groups )
            .filter( key => /__\d+/.test( key ) && result.groups[key] !== undefined )
        [0].slice( 2 )

        const match = result
        const matcher = this.matchers[matcherIndex]

        const token = new Token( matcher.type, match[0], new Range( position.clone(), position.clone().advance( match[0] ) ) )
        if ( matcher.parser ) {
            if ( typeof matcher.parser === 'function' ) {
                matcher.parser( token, match )
            }
            if ( typeof matcher.parser === 'object' ) {
                token.props = { ...token.props, ...matcher.parser }
            }
        }
        return token
    }

    /** 
     * Tokenizes the input text into an array of tokens
     * @param {string} text - The input text to be tokenized 
     * @returns {Token<T>[] & { text: string }} An array of tokens 
     */
    lex( text ) {
        const tokens = []
        let position = new Position( 0, 1, 1 )

        while ( position.index < text.length ) {
            const token = this.next( text, position )

            if ( !token ) {
                // If no token found, add an error token and advance text by one character
                tokens.push( new Token(
                    this.errorToken,
                    text[position.index],
                    new Range( position.clone(), position.clone().advance( text[position.index] ) ) )
                )
                position.advance( text[position.index] )
                continue
            }

            if ( this.props.postprocess ) {

                if ( !token.props.ignore ) {
                    if ( !token.props.merge || tokens.length === 0 || tokens[tokens.length - 1].type !== token.type ) {
                        tokens.push( token )
                    } else {
                        tokens[tokens.length - 1].text += token.text
                        tokens[tokens.length - 1].range.end = token.range.end.clone() // Update end position of merged token range
                    }
                }

            } else {
                tokens.push( token )
            }

            position.advance( token.text )
        }

        tokens.push( new Token( this.eofToken, '', new Range( position.clone(), position.clone() ) ) ) // Add EOF token at end of text
        tokens.text = text
        return tokens
    }
}

// Parser class
/** @template {string} T */
export class Parser {
    /** 
     * Creates a map of node types to themselves.
     * @template {string} T 
     * @param {T[]} types The node types
     * @returns {Readonly<{[K in T]: K}>} A map of node types to themselves
     */
    static Types( types ) {
        return Object.freeze( Object.fromEntries(
            types.map( t => [t, t] )
        ) )
    }

    /** 
     * @param {Token<T>[]} tokens The tokens to parse 
     * @param {T} errorToken The type of the error token. 
     * @param {T} eofToken The type of the EOF token. 
     **/
    constructor( tokens, errorToken, eofToken ) {
        this.tokens = tokens
        this.index = 0
        this.errorToken = errorToken
        this.eofToken = eofToken
    }

    eof() {
        return this.index >= this.tokens.length || this.peek().type === this.eofToken
    }

    /** @param {number} [lookahead=0] */
    peekStrict( lookahead = 0 ) {
        return this.tokens[this.index + lookahead]
    }
    /** @param {number} scan */
    scan( start ) {
        let scan = start
        while ( this.peekStrict( scan ).props.hidden ) scan++
        return scan
    }
    /** @param {number} [lookahead=0] */
    peek( lookahead = 0 ) {
        let offs = this.scan( 0 )
        while ( lookahead-- > 0 ) offs = this.scan( offs + 1 )
        return this.peekStrict( offs )
    }

    /** @param {...T} types */
    advance( ...types ) {
        const offs = this.scan( 0 )
        const token = this.tokens[this.index + offs]
        if ( types.length && !types.includes( token.type ) ) {
            throw new Error( `Expected ${types.join( " or " )} but got ${token.type} "${token.text}" at [l:${token.position.line} c:${token.position.column}]` )
        }
        this.index += offs + 1
        return token
    }
    /** @param {...T} types */
    advanceIf( ...types ) {
        const offs = this.scan( 0 )
        const token = this.tokens[this.index + offs]
        if ( types.length && types.includes( token.type ) ) {
            this.index += offs + 1
            return token
        }
    }
}