
const REFRESH_LINE = 0;
const REFRESH_ALLWAYS = 1;

class vtAtt
{
	/**
	 * Class constructor
	 * @param {*} fg Foreground color, if a vtAtt is passed, copy fg attributes
	 * @param {*} bg Background color
	 */
	constructor(fg=null, bg=null)
	{
		if(fg === null && bg === null)
		{
			this.foreGround = "#FFFFFF";
			this.backGround = "#000000";			
		}
		else if(fg instanceof vtAtt)
		{
			this.foreGround = src.foreGround;
			this.backGround = src.backGround;			
		}
		else
		{
			this.foreGround = fg;
			this.backGround = bg;
		}
		this.charW=1;
		this.charH=1;
	}

	drawChr(ctx, chr, x, y, charW, charH)
	{
		ctx.fillStyle = this.backGround;
		ctx.fillRect(x, y, charW, charH);
		ctx.fillStyle = this.foreGround;
		ctx.fillText(chr, x, y );
	}

	drawCursor(ctx, x, y, charW, charH)
	{
		ctx.fillStyle = this.foreGround;
		ctx.fillRect( x*charW, y*charH, charW, charH/2 );
	}
}

/**
 * Class for represent an VT-100 terminal
 */
class vt
{
	/**
	 * Class constructor
	 * @param {*} canvas Canvas where to draw the screen 
	 * @param {*} cols Number of columns desired for text output
	 * @param {*} rows Number of rows desired for text output
	 * @param {*} buffer How many rows will be saved (For scrolling)
	 */
	constructor(canvas, cols=80, rows=25, buffer=-1)
	{
		this.viewport = canvas;
		this.rows = rows;
		this.cols = cols;
		this.rowsBuffer = buffer < cols ? cols * 10 : buffer;		
		this.buffer = Array(cols*this.rowsBuffer);
		this.offset = 0;
		this.pos=0;
		this.cursorX = 0;
		this.cursorY = 0;
		this.cursorVisible = false;
		this.currentAttr = new vtAtt();
		this.refreshMode = 0;
		this.inEsc = false;
		this.kbBuffer = []; 
		this.escBuffer = "";      

		this.ctx = this.viewport.getContext("2d");
		this.ctx.strokeStyle = this.foreGround;
		this.ctx.font = "12px monospace"; 
		this.ctx.textBaseline = "top";

		this.viewport.tabIndex=1;
		this.viewport.onkeypress = (ev)=>{
			this.kbBuffer.push(ev.key);

			ev = ev || window.event;
			if (typeof ev.stopPropagation != "undefined") {
				ev.stopPropagation();
			} else {
				ev.cancelBubble = true;
			}
			ev.preventDefault();
		}

		this.viewport.onkeydown = (ev)=>{
			if (ev.keyCode === 9)
			{
				ev.preventDefault();
				this.kbBuffer.push('\t');
			}
		}
		
		this.clear();
	}

	/**
	 * Sets terminal font
	 * @param {*} font Font style to draw, ej "12px monospace"
	 */
	setFont(font="12px monospace")
	{
		this.ctx.font = font; 
	}

	/**
	 * Sets foreground and background colors for termina
	 * @param {*} foreGround Foreground color, ej "#FFFFFF"
	 * @param {*} backGround Background color, ej "#000000"
	 */
	setColors(foreGround="#FFFFFF",backGround="#000000")
	{
		this.foreGround = foreGround;
		this.backGround = backGround;
		this.ctx.strokeStyle = foreGround;
	}

	/**
	 * Paints terminal data
	 */
	refresh()
	{        
		let charW = this.viewport.width / this.cols;
		let charH = this.viewport.height / this.rows;

		let base = this.cols*this.offset;
		for(let i = 0; i < this.rows; i++ )
		{
			let offset = base + (i * this.cols);
			for(let j = 0; j < this.cols; j++)
			{   
				this.buffer[offset+j][1].drawChr(this.ctx, this.buffer[offset+j][0], j*charW, i*charH, charW, charH);
			}
		}
		this.currentAttr.drawCursor(this.ctx, this.cursorX, this.cursorY, charW, charH);
	}



	/**
	 * Clears terminal data
	 */
	clear()
	{
		for(let i = 0; i < this.buffer.length; i++ )
		{
			this.buffer[i]=[' ',this.currentAttr];
		}
		this.refresh();
	}

	/**
	 * Puts a character
	 * @param {*} ch 
	 */
	putc(ch)
	{
		if(this.inEsc === false)
		{
			let pos = this.cols*this.offset + this.cursorY * this.cols + this.cursorX;

			switch(ch)
			{
				case '\r':
					this.cursorY++;
					break;
				case '\n':
					this.cursorX=0;
					break;
				case '\t':
					this.cursorX+=4;
					break;
				case 8:
					this.cursorX--;
					if(this.cursorX<0)
					{
						this.cursorX=this.cols;
						this.cursorY--;
					}
					break
				case 27:
					this.inEsc = true;
				default:
					this.buffer[pos] = [ch,this.currentAttr];
					this.cursorX++;
			}

			// Checks for line ending
			if(this.cursorX > this.cols)
			{            
				this.cursorX=0;
				this.cursorY++;           
			}

			// Controls scrolling
			if(this.cursorY > this.rows)
			{
				this.scrollLines();
			}

			if(this.refresh || ch == '\n' )
				this.refresh();
		}
		else
		{
			
		}
	}

	/**
	 * Prints a string
	 * @param {*} str 
	 */
	printf(str)
	{
		for(let c of str)
		{
			this.putc(c);
		}
	}

	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Reads char from terminal
	 */
	async getc()
	{
		while(this.kbBuffer.length == 0)
		{
			await this.sleep(100);
		}
		
		let ch = this.kbBuffer.shift();
		switch(ch)
		{
			case 'Enter':
				this.putc('\r');
				ch='\n';
				break;
		}

		this.putc(ch);
		return ch;
	}

	/**
	 * Sets cursos at given coordinates
	 * @param {*} x X-coordinate
	 * @param {*} y Y-Coordinate
	 */
	gotoXY(x,y)
	{
		this.cursorX = x % this.cols;
		this.cursorY = parseInt(y + (x / this.cols));
		this.pos = this.cols*this.offset + this.cursorY * this.cols + this.cursorX; 
	}

	/**
	 * Set cursor on linear position 'pos'
	 * @param {*} pos Linear position to go.
	 */
	gotoPos(pos)
	{
		this.pos = pos;
		this.cursorX = pos % this.cols;
		this.cursorY = (pos - this.cursorX) / this.cols;
	}

	/**
	 * Scrolls buffer a number of lines
	 * @param {*} lines Lines to scroll
	 */
	scrollLines(lines=1)
	{
		this.offset+=lines;
		if(this.offset > this.rowsBuffer)
		{
			const lastL = (this.rowsBuffer-1) * this.cols;
			for(let i=0;i<lastL;i++)
			{
				this.buffer[i]=this.buffer[i+this.cols];
			}
			
			// Erases last row on buffer
			for(let i=lastL; i<lastL+this.cols; i++ )
			{
				this.buffer[i] = [' ',this.currentAttr];
			}
		}
	}
}
