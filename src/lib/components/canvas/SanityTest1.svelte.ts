export class Tester{


    stuff: {[id:string]:number} = $state({})


    addItem(){
        this.stuff[crypto.randomUUID()] = new Date().getTime();
    }
}