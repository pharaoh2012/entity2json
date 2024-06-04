import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { Project } from "ts-morph";
import JSON5 from "json5";
import { cors } from 'hono/cors'

const app = new Hono()

app.use(cors())

app.get('/*', async (c) => {
  const url = c.req.query("url");
  if (!url) return c.text('get ?url=.. or post /', 403);
  let tsSource = await fetch(url).then(r => r.text());
  return c.json(getEntityJson(tsSource))
})

app.post('/*', async (c) => {
  const body = await c.req.text();
  if (!body) {
    return c.text('post / with body', 403);
  }
  return c.json(getEntityJson(body))
})

const port = parseInt(process.env.PORT || "3000")
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})

function getEntityJson(tsSource: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("/tmp/entity.ts", tsSource);
  //project.addSourceFilesAtPaths(sourceFile);

  let ret: {}[] = [];
  sourceFile.getClasses().forEach(classDeclaration => {
    //let cls = {};
    let dec = classDeclaration.getDecorators();
    let name = classDeclaration.getName();
    let ett = classDeclaration.getDecorators().find(decorator => {
      return decorator.getName() == "Entity";
    })?.getArguments()[0];

    let entity = ett?.getText().replace(/['"]/g, "");
    let properties: any[] = [];

    classDeclaration.getProperties().forEach(property => {
      let name = property.getName();
      let type = property.getType().getText();
      let Column = property.getDecorators().find(decorator => {
        return decorator.getName() == "Column";
      });
      let column;
      if (Column) {
        try {
          column = JSON5.parse(Column.getArguments()[0].getText());
        } catch (error) {
          column = Column.getArguments()[0].getText();
          console.info(column, error);
        }

      }
      let prop = { name, type, column };
      properties.push(prop);
    });
    ret.push({ name, entity, properties });
    //console.info(cls);
  });
  return ret;
}